#!/bin/bash

# check-prerequisites.sh
# Checks for required design documents and returns paths

set -e

# Parse arguments
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Get current branch
BRANCH=$(git branch --show-current)

# Validate we're on a feature branch
if [[ ! "$BRANCH" =~ ^[0-9]+-[a-z-]+$ ]]; then
  echo "Error: Not on a feature branch (expected format: N-name)"
  exit 1
fi

# Set paths
FEATURE_DIR="specs/${BRANCH}"

# Check which documents are available
AVAILABLE_DOCS=()

if [ -f "$FEATURE_DIR/spec.md" ]; then
  AVAILABLE_DOCS+=("spec.md")
fi

if [ -f "$FEATURE_DIR/plan.md" ]; then
  AVAILABLE_DOCS+=("plan.md")
fi

if [ -f "$FEATURE_DIR/data-model.md" ]; then
  AVAILABLE_DOCS+=("data-model.md")
fi

if [ -f "$FEATURE_DIR/research.md" ]; then
  AVAILABLE_DOCS+=("research.md")
fi

if [ -f "$FEATURE_DIR/quickstart.md" ]; then
  AVAILABLE_DOCS+=("quickstart.md")
fi

if [ -d "$FEATURE_DIR/contracts" ]; then
  AVAILABLE_DOCS+=("contracts/")
fi

# Output results
if [ "$JSON_OUTPUT" = true ]; then
  # Convert array to JSON array
  DOCS_JSON=$(printf '%s\n' "${AVAILABLE_DOCS[@]}" | jq -R . | jq -s .)

  cat << EOF
{
  "BRANCH": "$BRANCH",
  "FEATURE_DIR": "$FEATURE_DIR",
  "AVAILABLE_DOCS": $DOCS_JSON
}
EOF
else
  echo "Branch: $BRANCH"
  echo "Feature Directory: $FEATURE_DIR"
  echo "Available Documents:"
  for doc in "${AVAILABLE_DOCS[@]}"; do
    echo "  - $doc"
  done
fi
