#!/usr/bin/env bash
# UniProfile Lambda packager
# Usage (from any directory): bash lambda/package.sh
# Or: cd lambda && bash package.sh
#
# Single command — copy shared module, zip, clean up.
# intelligence.js is canonical at uniprofile/intelligence.js.
# This script copies it in before zipping so the Lambda is never stale.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
OUT="$REPO_ROOT/uniprofile-lambda.zip"

echo "[package] Copying shared intelligence module..."
cp "$REPO_ROOT/intelligence.js" "$SCRIPT_DIR/intelligence.js"

echo "[package] Zipping..."
cd "$SCRIPT_DIR"
MSYS_NO_PATHCONV=1 7z a "$OUT" . -xr'!email-ingest' -xr'!*.zip' -xr'!package.sh' > /dev/null

echo "[package] Cleaning up..."
rm "$SCRIPT_DIR/intelligence.js"

SIZE=$(du -sh "$OUT" 2>/dev/null | cut -f1)
echo "[package] Done — $OUT ($SIZE)"
