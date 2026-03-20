#!/bin/bash

# MCP Authentication Setup Helper
# This script helps you set up environment variables for MCP authentication

echo "🔐 MCP Authentication Setup"
echo "============================"
echo ""
echo "This script will help you add MCP API tokens to your ~/.zshrc file."
echo ""
echo "⚠️  SECURITY NOTE: These tokens will be stored in plain text in ~/.zshrc"
echo "   Make sure to add ~/.zshrc to .gitignore if it's not already there."
echo ""

# Check if .zshrc exists
if [ ! -f ~/.zshrc ]; then
    echo "⚠️  ~/.zshrc does not exist. Creating it..."
    touch ~/.zshrc
fi

# Backup .zshrc
echo "📦 Backing up ~/.zshrc to ~/.zshrc.backup..."
cp ~/.zshrc ~/.zshrc.backup

# Check if MCP section already exists
if grep -q "# MCP Authentication" ~/.zshrc; then
    echo "⚠️  MCP authentication section already exists in ~/.zshrc"
    echo "   Remove it first or edit manually"
    echo ""
    read -p "Do you want to remove the existing section and re-add? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove existing MCP section
        sed -i.temp '/# MCP Authentication/,/# End MCP Authentication/d' ~/.zshrc
        rm ~/.zshrc.temp
    else
        echo "Exiting. Please edit ~/.zshrc manually."
        exit 1
    fi
fi

echo ""
echo "📝 Enter your API tokens (press Enter to skip services you don't use):"
echo ""

# GitHub
read -p "GitHub Personal Access Token: " github_token
if [ -n "$github_token" ]; then
    github_line="export GITHUB_PERSONAL_ACCESS_TOKEN=\"$github_token\""
else
    github_line="# export GITHUB_PERSONAL_ACCESS_TOKEN=\"your_github_pat_here\""
fi

# Supabase
read -p "Supabase Access Token: " supabase_token
if [ -n "$supabase_token" ]; then
    supabase_line="export SUPABASE_ACCESS_TOKEN=\"$supabase_token\""
else
    supabase_line="# export SUPABASE_ACCESS_TOKEN=\"your_supabase_token_here\""
fi

# Linear
read -p "Linear API Key: " linear_key
if [ -n "$linear_key" ]; then
    linear_line="export LINEAR_API_KEY=\"$linear_key\""
else
    linear_line="# export LINEAR_API_KEY=\"your_linear_api_key_here\""
fi

# PostHog
read -p "PostHog Personal API Key: " posthog_key
if [ -n "$posthog_key" ]; then
    posthog_line="export POSTHOG_PERSONAL_API_KEY=\"$posthog_key\""
else
    posthog_line="# export POSTHOG_PERSONAL_API_KEY=\"your_posthog_key_here\""
fi

# Asana
read -p "Asana Personal Access Token: " asana_token
if [ -n "$asana_token" ]; then
    asana_line="export ASANA_PERSONAL_ACCESS_TOKEN=\"$asana_token\""
else
    asana_line="# export ASANA_PERSONAL_ACCESS_TOKEN=\"your_asana_pat_here\""
fi

# Circleback
read -p "Circleback API Key: " circleback_key
if [ -n "$circleback_key" ]; then
    circleback_line="export CIRCLEBACK_API_KEY=\"$circleback_key\""
else
    circleback_line="# export CIRCLEBACK_API_KEY=\"your_circleback_key_here\""
fi

# Postman
read -p "Postman API Key: " postman_key
if [ -n "$postman_key" ]; then
    postman_line="export POSTMAN_API_KEY=\"$postman_key\""
else
    postman_line="# export POSTMAN_API_KEY=\"your_postman_key_here\""
fi

# Append to .zshrc
echo ""
echo "✏️  Adding to ~/.zshrc..."
echo "" >> ~/.zshrc
echo "# MCP Authentication" >> ~/.zshrc
echo "# Added: $(date)" >> ~/.zshrc
echo "" >> ~/.zshrc
echo "$github_line" >> ~/.zshrc
echo "$supabase_line" >> ~/.zshrc
echo "$linear_line" >> ~/.zshrc
echo "$posthog_line" >> ~/.zshrc
echo "$asana_line" >> ~/.zshrc
echo "$circleback_line" >> ~/.zshrc
echo "$postman_line" >> ~/.zshrc
echo "" >> ~/.zshrc
echo "# End MCP Authentication" >> ~/.zshrc

echo "✅ Done!"
echo ""
echo "🔄 To apply changes, run:"
echo "   source ~/.zshrc"
echo ""
echo "🚀 Or restart your terminal/Claude Code"
echo ""
echo "🔍 To verify, run:"
echo "   echo \$GITHUB_PERSONAL_ACCESS_TOKEN"
echo ""
