#!/usr/bin/env bash
# Deploy uniprofile-api Lambda
# Run from the repo root: bash scripts/deploy-lambda.sh

set -e

echo "Packaging lambda/..."
powershell -Command "Compress-Archive -Path lambda/* -DestinationPath C:/tmp/uniprofile-lambda.zip -Force"

echo "Uploading to AWS Lambda..."
aws lambda update-function-code \
  --function-name uniprofile-api \
  --zip-file fileb://C:/tmp/uniprofile-lambda.zip \
  --query '{FunctionName:FunctionName,CodeSize:CodeSize,LastModified:LastModified}' \
  --output table

echo "Done."
