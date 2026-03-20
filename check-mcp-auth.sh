#!/bin/bash

# MCP Authentication Status Checker
# Checks which MCP environment variables are set

echo "🔍 MCP Authentication Status Check"
echo "=================================="
echo ""

# Track status
set_count=0
unset_count=0

# Check each MCP variable
check_var() {
    local service="$1"
    local var_name="$2"

    if [ -n "${!var_name}" ]; then
        value="${!var_name}"
        echo "✅ $service: SET (length: ${#value})"
        set_count=$((set_count + 1))
    else
        echo "❌ $service: NOT SET"
        unset_count=$((unset_count + 1))
    fi
}

# Check all MCP variables
check_var "GitHub" "GITHUB_PERSONAL_ACCESS_TOKEN"
check_var "Supabase" "SUPABASE_ACCESS_TOKEN"
check_var "Linear" "LINEAR_API_KEY"
check_var "PostHog" "POSTHOG_PERSONAL_API_KEY"
check_var "Asana" "ASANA_PERSONAL_ACCESS_TOKEN"
check_var "Circleback" "CIRCLEBACK_API_KEY"
check_var "Postman" "POSTMAN_API_KEY"

echo ""
echo "Summary:"
echo "  ✅ Set: $set_count"
echo "  ❌ Not set: $unset_count"
echo ""

if [ $unset_count -gt 0 ]; then
    echo "📝 To set up missing tokens, run:"
    echo "   ./setup-mcp-auth.sh"
    echo ""
    echo "   Or see MCP_AUTH_SETUP.md for manual instructions"
fi

if [ $set_count -gt 0 ]; then
    echo "✅ Tokens are set! Try:"
    echo "   source ~/.zshrc    # If not already loaded"
    echo "   Then restart Claude Code"
fi
