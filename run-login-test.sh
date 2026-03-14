#!/bin/bash

echo "Enter your password for clance@developerlabs.ai:"
read -s password

TEST_EMAIL="clance@developerlabs.ai" \
TEST_PASSWORD="$password" \
npx playwright test tests/debug-login.spec.ts --headed
