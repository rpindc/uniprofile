#!/usr/bin/env bash
# Packages and deploys uniprofile-watch Lambda.
# Run from any directory: bash lambda/watch/package-watch.sh
# Copies intelligence.js from repo root before zipping (same pattern as main package.sh).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
OUT="$REPO_ROOT/uniprofile-watch.zip"
OUT_WIN="$(cygpath -w "$OUT")"

echo "[package-watch] Copying intelligence.js from repo root..."
cp "$REPO_ROOT/intelligence.js" "$SCRIPT_DIR/intelligence.js"

echo "[package-watch] Syntax check..."
node --check "$SCRIPT_DIR/index.js"         || { echo "[package-watch] ABORT: index.js failed node --check"; exit 1; }
node --check "$SCRIPT_DIR/intelligence.js"  || { echo "[package-watch] ABORT: intelligence.js failed node --check"; exit 1; }
echo "[package-watch] Syntax OK."

echo "[package-watch] Regex range check (Node 20 compat)..."
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
" "$SCRIPT_DIR/index.js" "$SCRIPT_DIR/intelligence.js" || exit 1
echo "[package-watch] Regex range OK."

echo "[package-watch] Zipping..."
SEVENZIP="/c/Program Files/7-Zip/7z.exe"
if ! command -v 7z &>/dev/null && [ -f "$SEVENZIP" ]; then
  SEVENZIP_CMD="$SEVENZIP"
else
  SEVENZIP_CMD="7z"
fi

rm -f "$OUT"
cd "$SCRIPT_DIR"
MSYS_NO_PATHCONV=1 "$SEVENZIP_CMD" a "$OUT_WIN" index.js intelligence.js > /dev/null

echo "[package-watch] Cleaning up intelligence.js..."
rm "$SCRIPT_DIR/intelligence.js"

SIZE=$(du -sh "$OUT" 2>/dev/null | cut -f1)
echo "[package-watch] Done — $OUT ($SIZE)"
