#!/bin/bash

# Security Check Script
# Run this before committing or deploying

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔒 Running Security Checks..."
echo ""

ERRORS=0

# Check 1: .env files not tracked
echo "📋 Checking for tracked .env files..."
if git ls-files | grep -E '\.env$' > /dev/null; then
  echo -e "${RED}❌ ERROR: .env files are being tracked by git${NC}"
  git ls-files | grep -E '\.env$'
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No .env files tracked${NC}"
fi

# Check 2: No hardcoded API keys in source
echo ""
echo "📋 Checking for hardcoded API keys..."
if grep -r "sk-[a-zA-Z0-9]{20,}" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "REDACTED" > /dev/null; then
  echo -e "${RED}❌ ERROR: Potential API keys found in source${NC}"
  grep -rn "sk-[a-zA-Z0-9]{20,}" src/ --exclude-dir=node_modules | grep -v "REDACTED" || true
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No API keys found in source${NC}"
fi

# Check 3: .env.example exists and has no real values
echo ""
echo "📋 Checking .env.example..."
if [ -f ".env.example" ]; then
  if grep -E "sk-[a-zA-Z0-9]{20,}" .env.example > /dev/null; then
    echo -e "${RED}❌ ERROR: .env.example contains what looks like real API keys${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ .env.example looks safe${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  WARNING: .env.example not found${NC}"
fi

# Check 4: File permissions
echo ""
echo "📋 Checking file permissions..."
if [ -f ".env" ]; then
  PERMS=$(stat -f "%Lp" .env 2>/dev/null || stat -c "%a" .env 2>/dev/null)
  if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
    echo -e "${YELLOW}⚠️  WARNING: .env has permissions $PERMS (recommended: 600 or 400)${NC}"
    echo "   Run: chmod 600 .env"
  else
    echo -e "${GREEN}✅ .env has secure permissions ($PERMS)${NC}"
  fi
fi

# Check 5: No secrets in logs
echo ""
echo "📋 Checking logs directory..."
if [ -d "logs" ]; then
  if grep -r "sk-[a-zA-Z0-9]{20,}" logs/ 2>/dev/null | grep -v "REDACTED" > /dev/null; then
    echo -e "${RED}❌ ERROR: API keys found in logs${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ Logs are clean${NC}"
  fi
fi

# Check 6: .gitignore is comprehensive
echo ""
echo "📋 Checking .gitignore..."
REQUIRED_PATTERNS=(".env" "node_modules" "dist" "logs/" "*.log" ".env.local")
MISSING=0
for pattern in "${REQUIRED_PATTERNS[@]}"; do
  if ! grep -q "^${pattern}" .gitignore; then
    echo -e "${YELLOW}⚠️  Missing pattern in .gitignore: ${pattern}${NC}"
    MISSING=$((MISSING + 1))
  fi
done
if [ $MISSING -eq 0 ]; then
  echo -e "${GREEN}✅ .gitignore has essential patterns${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Security check failed with $ERRORS error(s)${NC}"
  echo "Please fix the issues above before committing or deploying."
  exit 1
else
  echo -e "${GREEN}✅ All security checks passed!${NC}"
  exit 0
fi
