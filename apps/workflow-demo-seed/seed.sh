#!/bin/sh
set -eu

seed_root=$(mktemp -d)
trap 'rm -rf "$seed_root"' EXIT
survey_digest="sha256:135b68973584f7ff75cf0cff2c8f4c141dd97f49d9090fbf003a91f1172fe44f"
survey_hash=${survey_digest#sha256:}
mkdir -p "$seed_root/surveys"
cp /opt/kajay/review-demo-survey.json "$seed_root/surveys/$survey_hash.json"
cat > "$seed_root/workflow.json" <<JSON
{"formatVersion":2,"initialStep":"survey","steps":[{"key":"survey","kind":"survey","surveyDefinitionDigest":"$survey_digest","next":"review"},{"key":"review","kind":"review","assignedPermission":"kajay:workflow:review","approvedNext":"approved","deniedNext":"denied","changesRequestedNext":"survey"},{"key":"approved","kind":"end"},{"key":"denied","kind":"end"}]}
JSON
cat > "$seed_root/manifest.json" <<JSON
{"formatVersion":1,"managedDefinitionName":"review-demo","versionLabel":"1.0.0","conformanceVersion":2,"workflowPath":"workflow.json","surveys":[{"digest":"$survey_digest","path":"surveys/$survey_hash.json"}],"requiredBindings":[]}
JSON

(cd "$seed_root" && zip -q -X review-demo.kajay manifest.json workflow.json "surveys/$survey_hash.json")

seed_attempt=0
until curl --silent --fail http://kajay-workflow-host:8080/health >/dev/null; do
  seed_attempt=$((seed_attempt + 1))
  if [ "$seed_attempt" -ge 120 ]; then
    echo "Workflow host did not become healthy within 120 seconds." >&2
    exit 1
  fi
  sleep 1
done

token=$(curl --silent --fail-with-body \
  --data-urlencode client_id=client_kajay_local_demo \
  --data-urlencode client_secret=secret_kajay_local_demo \
  --data-urlencode grant_type=client_credentials \
  --data-urlencode 'scope=kajay:definition:manage kajay:definition:promote kajay:environment:manage' \
  http://kajay-workos-emulate:4100/oauth2/token | jq -er .access_token)
authorization="Authorization: Bearer $token"

environment_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header "$authorization" \
  --header 'Content-Type: application/json' \
  --data '{"name":"test","displayName":"Test","requiresApproval":false,"position":200}' \
  http://kajay-workflow-host:8080/api/management/environments)
case "$environment_status" in 201|409) ;; *) exit 1 ;; esac

release_digest=$(curl --silent --fail-with-body \
  --header "$authorization" \
  --header 'Content-Type: application/vnd.kajay.bundle+zip' \
  --data-binary "@$seed_root/review-demo.kajay" \
  http://kajay-workflow-host:8080/api/management/releases/install | jq -er .digest)
activation_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request PUT \
  --header "$authorization" \
  --header 'Content-Type: application/json' \
  --header 'If-Match: "0"' \
  --data "{\"releaseDigest\":\"$release_digest\"}" \
  http://kajay-workflow-host:8080/api/management/environments/test/activations/review-demo)
case "$activation_status" in 200|412) ;; *) exit 1 ;; esac

echo "Kajay review demo release is active."
