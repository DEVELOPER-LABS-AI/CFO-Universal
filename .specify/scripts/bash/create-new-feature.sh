#!/bin/bash

# create-new-feature.sh
# Creates a new feature branch and initializes the spec directory structure

set -e

# Parse arguments
JSON_OUTPUT=false
NUMBER=""
SHORT_NAME=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    --number)
      NUMBER="$2"
      shift 2
      ;;
    --short-name)
      SHORT_NAME="$2"
      shift 2
      ;;
    *)
      DESCRIPTION="$1"
      shift
      ;;
  esac
done

# Validate required parameters
if [ -z "$NUMBER" ] || [ -z "$SHORT_NAME" ] || [ -z "$DESCRIPTION" ]; then
  echo "Error: Missing required parameters"
  echo "Usage: $0 --json --number N --short-name \"name\" \"description\""
  exit 1
fi

# Set variables
BRANCH_NAME="${NUMBER}-${SHORT_NAME}"
FEATURE_DIR="specs/${BRANCH_NAME}"
SPEC_FILE="${FEATURE_DIR}/spec.md"
PLAN_FILE="${FEATURE_DIR}/plan.md"
TASKS_FILE="${FEATURE_DIR}/tasks.md"
CHECKLISTS_DIR="${FEATURE_DIR}/checklists"

# Create feature directory structure
mkdir -p "$FEATURE_DIR"
mkdir -p "$CHECKLISTS_DIR"

# Create and checkout new branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Initialize spec file with basic structure
cat > "$SPEC_FILE" << 'EOF'
# Feature Specification: [FEATURE_NAME]

**Status**: Draft
**Created**: [DATE]
**Last Updated**: [DATE]

---

## Overview

### Feature Summary

[1-2 sentence high-level description]

### Business Value

[Business problem and value]

### Target Users

[User types]

---

## User Scenarios

[To be filled]

---

## Functional Requirements

[To be filled]

---

## Success Criteria

[To be filled]

---

## Dependencies

[To be filled]

---

## Assumptions

[To be filled]

---

## Out of Scope

[To be filled]

EOF

# Output results
if [ "$JSON_OUTPUT" = true ]; then
  cat << EOF
{
  "BRANCH_NAME": "$BRANCH_NAME",
  "FEATURE_DIR": "$FEATURE_DIR",
  "SPEC_FILE": "$SPEC_FILE",
  "PLAN_FILE": "$PLAN_FILE",
  "TASKS_FILE": "$TASKS_FILE",
  "CHECKLISTS_DIR": "$CHECKLISTS_DIR",
  "NUMBER": "$NUMBER",
  "SHORT_NAME": "$SHORT_NAME",
  "DESCRIPTION": "$DESCRIPTION"
}
EOF
else
  echo "Created feature: $BRANCH_NAME"
  echo "Spec file: $SPEC_FILE"
fi
