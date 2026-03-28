#!/bin/bash

# Setup git hooks for security checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔒 Setting up git hooks..."

# Create .git/hooks directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/.git/hooks"

# Link pre-commit hook
ln -sf "$SCRIPT_DIR/pre-commit.sh" "$PROJECT_ROOT/.git/hooks/pre-commit"

echo "✅ Git hooks installed successfully"
echo ""
echo "Active hooks:"
echo "  - pre-commit: Checks for .env files and API keys"
