#!/bin/bash

# Pre-commit hook to prevent committing sensitive data
# Usage: ln -sf $(pwd)/scripts/pre-commit.sh .git/hooks/pre-commit

echo "🔒 Checking for sensitive files..."

# Check for .env files
if git diff --cached --name-only | grep -E '^\.env$'; then
  echo "❌ ERROR: Attempting to commit .env file!"
  echo "   This file contains sensitive API keys and should not be committed."
  exit 1
fi

# Check for files containing API keys
if git diff --cached --name-only | grep -E '\.(ts|js|json)$'; then
  # Check for common API key patterns
  FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|json)$')
  if [ -n "$FILES" ]; then
    if git diff --cached $FILES | grep -E '(sk-[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9\-_]{20,}["\s]|Bearer\s+[a-zA-Z0-9]{20,})' > /dev/null; then
      echo "❌ ERROR: Potential API key detected in staged files!"
      echo "   Please remove sensitive data before committing."
      exit 1
    fi
  fi
fi

echo "✅ Pre-commit checks passed"
exit 0
