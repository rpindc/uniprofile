#!/usr/bin/env bash
# UniProfile Lambda packager
# Usage (from any directory): bash lambda/package.sh
# Or: cd lambda && bash package.sh
#
# Single command — copy shared module, zip, clean up.
# intelligence.js is canonical at uniprofile/intelligence.js.
# This script copies it in before zipping so the Lambda is never stale.
#
# Windows notes:
#   7-Zip is a native Windows binary — it cannot read MSYS /c/Users/... paths.
#   All paths passed to 7z must be Windows-style (cygpath -w).
#   The old zip is always deleted first so 7z never updates stale content.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
OUT="$REPO_ROOT/uniprofile-lambda.zip"
OUT_WIN="$(cygpath -w "$OUT")"
SRC_WIN="$(cygpath -w "$SCRIPT_DIR")"

echo "[package] Copying shared intelligence module..."
cp "$REPO_ROOT/intelligence.js" "$SCRIPT_DIR/intelligence.js"

echo "[package] Syntax check..."
node --check "$SCRIPT_DIR/index.js"        || { echo "[package] ABORT: index.js failed node --check"; exit 1; }
node --check "$SCRIPT_DIR/intelligence.js" || { echo "[package] ABORT: intelligence.js failed node --check"; exit 1; }
echo "[package] Syntax OK."

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
MSYS_NO_PATHCONV=1 "$SEVENZIP_CMD" a "$OUT_WIN" . -xr'!email-ingest' -xr'!*.zip' -xr'!*.sh' > /dev/null

echo "[package] Cleaning up..."
rm "$SCRIPT_DIR/intelligence.js"

SIZE=$(du -sh "$OUT" 2>/dev/null | cut -f1)
echo "[package] Done — $OUT ($SIZE)"
