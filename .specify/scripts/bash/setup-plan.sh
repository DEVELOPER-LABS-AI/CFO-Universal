#!/bin/bash

# setup-plan.sh
# Sets up paths and context for the planning phase

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
SPECS_DIR="specs/${BRANCH}"
FEATURE_SPEC="${SPECS_DIR}/spec.md"
IMPL_PLAN="${SPECS_DIR}/plan.md"
RESEARCH_DOC="${SPECS_DIR}/research.md"
DATA_MODEL="${SPECS_DIR}/data-model.md"
CONTRACTS_DIR="${SPECS_DIR}/contracts"
QUICKSTART="${SPECS_DIR}/quickstart.md"

# Validate spec exists
if [ ! -f "$FEATURE_SPEC" ]; then
  echo "Error: Feature spec not found at $FEATURE_SPEC"
  exit 1
fi

# Create directories if needed
mkdir -p "$CONTRACTS_DIR"

# Initialize plan.md if it doesn't exist
if [ ! -f "$IMPL_PLAN" ]; then
  touch "$IMPL_PLAN"
fi

# Output results
if [ "$JSON_OUTPUT" = true ]; then
  cat << EOF
{
  "BRANCH": "$BRANCH",
  "SPECS_DIR": "$SPECS_DIR",
  "FEATURE_SPEC": "$FEATURE_SPEC",
  "IMPL_PLAN": "$IMPL_PLAN",
  "RESEARCH_DOC": "$RESEARCH_DOC",
  "DATA_MODEL": "$DATA_MODEL",
  "CONTRACTS_DIR": "$CONTRACTS_DIR",
  "QUICKSTART": "$QUICKSTART"
}
EOF
else
  echo "Branch: $BRANCH"
  echo "Specs Directory: $SPECS_DIR"
  echo "Feature Spec: $FEATURE_SPEC"
  echo "Implementation Plan: $IMPL_PLAN"
fi
