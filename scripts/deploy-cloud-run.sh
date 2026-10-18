#!/usr/bin/env bash
set -euo pipefail
# Explicit arguments prevent deploying into whichever project happens to be active.
if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo 'Usage: scripts/deploy-cloud-run.sh PROJECT_ID RUNTIME_ENV_YAML [REGION]' >&2
  echo 'RUNTIME_ENV_YAML must be a private local file; use Secret Manager references for API keys.' >&2
  exit 2
fi
scamshield_project="$1"
scamshield_env_file="$2"
scamshield_region="${3:-us-central1}"
scamshield_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scamshield_cli="${GCLOUD_BIN:-gcloud}"
if [[ ! -f "$scamshield_env_file" ]]; then
  echo 'Runtime environment file does not exist.' >&2
  exit 2
fi
cd "$scamshield_root"
# Public HTTP reaches the app access gate; Cloud Run IAM login is not required of visitors.
# Zero minimum instances limits idle cost. Limits do not constitute a billing hard cap.
exec "$scamshield_cli" run deploy scamshield \
  --source . \
  --project "$scamshield_project" \
  --region "$scamshield_region" \
  --service-account "scamshield-runtime@${scamshield_project}.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --min 0 \
  --max 1 \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 8 \
  --cpu 1 \
  --memory 512Mi \
  --cpu-throttling \
  --timeout 60 \
  --env-vars-file "$scamshield_env_file" \
  --quiet
