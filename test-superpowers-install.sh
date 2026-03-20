#!/bin/bash

# Test script to verify superpowers installation
echo "Testing superpowers installation..."
echo ""

echo "1. Checking if superpowers-marketplace is added..."
if grep -q "superpowers-marketplace" ~/.claude/plugins/known_marketplaces.json 2>/dev/null; then
    echo "   ✓ superpowers-marketplace is registered"
else
    echo "   ✗ superpowers-marketplace not found"
    echo "   Run: /plugin marketplace add obra/superpowers-marketplace"
fi

echo ""
echo "2. Checking if claude-plugins-official marketplace is valid..."
if [ -f ~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json ]; then
    python3 -c "import json; json.load(open('/Users/bradywilson/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json'))" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✓ claude-plugins-official marketplace.json is valid"
    else
        echo "   ✗ claude-plugins-official marketplace.json has errors"
    fi
else
    echo "   ✗ claude-plugins-official marketplace not found"
fi

echo ""
echo "3. Checking for installed superpowers plugin..."
if [ -d ~/.claude/plugins/cache/*/superpowers ]; then
    echo "   ✓ superpowers plugin is installed"
    ls -la ~/.claude/plugins/cache/*/superpowers 2>/dev/null | head -5
else
    echo "   ✗ superpowers plugin not found in cache"
fi

echo ""
echo "4. Testing superpowers marketplace..."
if [ -f ~/.claude/plugins/marketplaces/superpowers-marketplace/.claude-plugin/marketplace.json ]; then
    echo "   ✓ superpowers-marketplace is available"
    python3 -c "import json; data=json.load(open('/Users/bradywilson/.claude/plugins/marketplaces/superpowers-marketplace/.claude-plugin/marketplace.json')); print(f'   Available plugins: {[p[\"name\"] for p in data.get(\"plugins\", [])]}')"
else
    echo "   ✗ superpowers-marketplace not found"
fi

echo ""
echo "Next steps:"
echo "1. If all checks pass, try: /plugin install superpowers@superpowers-marketplace"
echo "2. If there are still errors, restart Claude Code and try again"
echo "3. The hooks.json in your project will auto-install on session start"
