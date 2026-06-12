#!/usr/bin/env bash
# UniProfile Lambda packager + deployer
# Usage (from any directory):
#   bash lambda/package.sh            — build zip only
#   bash lambda/package.sh --deploy   — build → deploy → verify CodeSize → smoke test
#
# intelligence.js is canonical at uniprofile/intelligence.js.
# This script copies it in before zipping so the Lambda is never stale.
#
# Windows notes:
#   7-Zip is a native Windows binary — it cannot read MSYS /c/Users/... paths.
#   All paths passed to 7z must be Windows-style (cygpath -w).
#   The old zip is always deleted first so 7z never updates stale content.
#
# ── Outage capture protocol — run BEFORE touching anything ───────────────────
#   aws logs filter-log-events \
#     --log-group-name /aws/lambda/uniprofile-api \
#     --start-time $(($(date -u +%s)-300))000 \
#     --filter-pattern '"SyntaxError" OR "ERROR" OR "REPORT"'
#   aws lambda get-function --function-name uniprofile-api \
#     --query 'Configuration.{CodeSize:CodeSize,LastModified:LastModified}'
#   git log -1
# ─────────────────────────────────────────────────────────────────────────────

set -e

DEPLOY=false
for arg in "$@"; do [[ "$arg" == "--deploy" ]] && DEPLOY=true; done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FUNCTION_NAME="uniprofile-api"
OUT="$REPO_ROOT/uniprofile-lambda.zip"
OUT_WIN="$(cygpath -w "$OUT")"
SRC_WIN="$(cygpath -w "$SCRIPT_DIR")"

echo "[package] Copying shared intelligence module (LF-normalised)..."
# core.autocrlf=true on Windows checks out files with CRLF; Lambda runs on Linux
# and Node 20 rejects CRLF in some source constructs. Always copy the LF git blob.
git -C "$REPO_ROOT" show HEAD:intelligence.js > "$SCRIPT_DIR/intelligence.js"

echo "[package] Syntax check..."
node --check "$SCRIPT_DIR/index.js"        || { echo "[package] ABORT: index.js failed node --check"; exit 1; }
node --check "$SCRIPT_DIR/intelligence.js" || { echo "[package] ABORT: intelligence.js failed node --check"; exit 1; }
echo "[package] Syntax OK."

echo "[package] Null-byte / control-char scan..."
# Node 20 rejects a literal 0x00 in source at parse time (SyntaxError: Invalid or
# unexpected token). Block every C0 control byte except tab(9), LF(10), CR(13) —
# none of the others belong in JS source regardless of Node version.
node -e "
var fs=require('fs');
var files=process.argv.slice(1);
var bad=false;
files.forEach(function(f){
  var data=fs.readFileSync(f);
  for(var i=0;i<data.length;i++){
    var b=data[i];
    if(b<=8||(b>=11&&b<=12)||(b>=14&&b<=31)){
      var ctx=data.slice(Math.max(0,i-20),i+20).toString('hex');
      console.error('ABORT: '+f+': control byte 0x'+b.toString(16).padStart(2,'0')+' at offset '+i+' context='+ctx);
      bad=true;break;
    }
  }
});
process.exit(bad?1:0);
" "$SRC_WIN\\index.js" "$SRC_WIN\\intelligence.js" || { echo "[package] ABORT: control byte in source — see above"; exit 1; }
echo "[package] Null-byte scan OK."

echo "[package] Regex range check (Node 20 compat)..."
# [+-] is a character range from + to - in ECMAScript. Node 20 rejects it; Node 22+ tolerates it.
# This Node script scans for the plus-before-dash pattern inside character classes.
node -e "
var fs=require('fs');
var files=process.argv.slice(1);
var bad=false;
files.forEach(function(f){
  var lines=fs.readFileSync(f,'utf8').split('\n');
  lines.forEach(function(l,i){
    if(/\[[^\]]*\+-[^\]]*\]/.test(l)){
      console.error('ABORT: '+f+':'+(i+1)+': [+-] regex range detected (Node 20 rejects this). Use [-+] instead.');
      bad=true;
    }
  });
});
process.exit(bad?1:0);
" "$SRC_WIN\\index.js" "$SRC_WIN\\intelligence.js" || exit 1
echo "[package] Regex range OK."

echo "[package] Zipping..."
SEVENZIP="/c/Program Files/7-Zip/7z.exe"
if ! command -v 7z &>/dev/null && [ -f "$SEVENZIP" ]; then
  SEVENZIP_CMD="$SEVENZIP"
else
  SEVENZIP_CMD="7z"
fi

rm -f "$OUT"   # always delete first — 7z 'a' updates in place and can leave stale files
cd "$SCRIPT_DIR"   # cd so source is '.' — avoids lambda\ prefix in zip entries
MSYS_NO_PATHCONV=1 "$SEVENZIP_CMD" a "$OUT_WIN" . -xr'!email-ingest' -xr'!watch' -xr'!*.zip' -xr'!*.sh' > /dev/null

echo "[package] Cleaning up..."
rm "$SCRIPT_DIR/intelligence.js"

LOCAL_SIZE=$(wc -c < "$OUT" | tr -d ' \r')
SIZE=$(du -sh "$OUT" 2>/dev/null | cut -f1)
echo "[package] Built — $OUT ($SIZE, ${LOCAL_SIZE} bytes)"

if [ "$DEPLOY" = false ]; then
  echo "[package] Done (build only). Run with --deploy to deploy and verify."
  exit 0
fi

# ── deploy phase ─────────────────────────────────────────────────────────────

echo "[deploy] Uploading to $FUNCTION_NAME..."
DEPLOY_JSON=$(MSYS_NO_PATHCONV=1 aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$OUT_WIN" \
  --output json)

REMOTE_SIZE=$(echo "$DEPLOY_JSON" | grep '"CodeSize"' | grep -o '[0-9]\+')
REMOTE_TS=$(echo  "$DEPLOY_JSON" | grep '"LastModified"' | sed 's/.*"\([^"]*\)".*/\1/')
echo "[deploy] Lambda reports CodeSize=$REMOTE_SIZE LastModified=$REMOTE_TS"

if [ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]; then
  echo "[deploy] ABORT: CodeSize mismatch (local=${LOCAL_SIZE} remote=${REMOTE_SIZE}) — deploy did not take."
  exit 1
fi
echo "[deploy] CodeSize verified OK."

echo "[deploy] Waiting 6 s for Lambda to warm up..."
sleep 6

echo "[deploy] Smoke test — GET /api/v1/me (expect 200/401, never errorType or 5xx)..."
SMOKE_FILE="$(mktemp)"
SMOKE_PAYLOAD=$(printf '%s' '{"httpMethod":"GET","path":"/api/v1/me","headers":{"Authorization":"Bearer smoke"},"queryStringParameters":null}' | base64 -w0)
MSYS_NO_PATHCONV=1 aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$SMOKE_PAYLOAD" \
  "$(cygpath -w "$SMOKE_FILE")" \
  --output json > /dev/null
SMOKE_BODY=$(cat "$SMOKE_FILE"); rm -f "$SMOKE_FILE"

if echo "$SMOKE_BODY" | grep -qE '"errorType"|SyntaxError|"Runtime\.'; then
  echo "[deploy] SMOKE FAIL — Lambda returned a runtime error:"
  echo "$SMOKE_BODY"
  exit 1
fi
SMOKE_STATUS=$(echo "$SMOKE_BODY" | grep -o '"statusCode":[0-9]*' | grep -o '[0-9]*')
if [[ "$SMOKE_STATUS" == 5* ]]; then
  echo "[deploy] SMOKE FAIL — got HTTP $SMOKE_STATUS from Lambda"
  echo "$SMOKE_BODY"
  exit 1
fi

echo "[deploy] Smoke OK (statusCode: $SMOKE_STATUS)"

echo "[deploy] Recording deploy timestamps in SSM (best-effort)..."
DEPLOY_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name "/uniprofile/deploy/last_deploy_at" --value "$DEPLOY_TS" --type String --overwrite > /dev/null 2>&1 && echo "[deploy] SSM last_deploy_at=$DEPLOY_TS" || echo "[deploy] SSM write skipped (non-fatal)"
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name "/uniprofile/deploy/last_smoke_at"  --value "$DEPLOY_TS" --type String --overwrite > /dev/null 2>&1 && echo "[deploy] SSM last_smoke_at=$DEPLOY_TS"  || echo "[deploy] SSM write skipped (non-fatal)"

echo "[deploy] DONE — $FUNCTION_NAME deployed, verified, and healthy."
