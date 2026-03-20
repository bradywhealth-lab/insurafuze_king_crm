# MCP Authentication Setup Guide

## Problem
Your MCP plugins are failing authorization because required API keys/tokens are not set as environment variables.

## Required Environment Variables

Add the following to your `~/.zshrc` file (replace `your_token_here` with actual tokens):

```bash
# GitHub MCP
export GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat_here"

# Supabase MCP
export SUPABASE_ACCESS_TOKEN="your_supabase_token_here"

# Linear MCP
export LINEAR_API_KEY="your_linear_api_key_here"

# PostHog MCP
export POSTHOG_PERSONAL_API_KEY="your_posthog_key_here"

# Asana MCP
export ASANA_PERSONAL_ACCESS_TOKEN="your_asana_pat_here"

# Circleback MCP
export CIRCLEBACK_API_KEY="your_circleback_key_here"

# Postman MCP
export POSTMAN_API_KEY="your_postman_key_here"
```

## How to Get Each Token

### 1. GitHub Personal Access Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Select scopes:
   - `repo` (full repository access)
   - `read:org` (organization access)
4. Generate and copy the token
5. Set as: `GITHUB_PERSONAL_ACCESS_TOKEN`

### 2. Supabase Access Token
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy your `anon` or `service_role` key
5. Set as: `SUPABASE_ACCESS_TOKEN`

### 3. Linear API Key
1. Go to https://linear.app/settings/api
2. Click "Create personal API key"
3. Give it a name and copy the key
4. Set as: `LINEAR_API_KEY`

### 4. PostHog Personal API Key
1. Go to your PostHog project
2. Go to Settings → Personal API Keys
3. Create a new key or copy existing
4. Set as: `POSTHOG_PERSONAL_API_KEY`

### 5. Asana Personal Access Token
1. Go to https://app.asana.com/0/my-apps
2. Click "Manage Developer Apps"
3. Click "New Personal Access Token"
4. Give it a name and copy the token
5. Set as: `ASANA_PERSONAL_ACCESS_TOKEN`

### 6. Circleback API Key
1. Contact Circleback support or check their dashboard
2. Set as: `CIRCLEBACK_API_KEY`

### 7. Postman API Key
1. Go to https://postman.com/settings/api-keys
2. Click "Generate API Key"
3. Give it a name and copy the key
4. Set as: `POSTMAN_API_KEY`

## Installation Steps

1. **Get your tokens** (follow instructions above for services you use)

2. **Edit your zshrc:**
   ```bash
   nano ~/.zshrc
   ```

3. **Add the export lines** at the end of the file

4. **Save and exit** (Ctrl+X, Y, Enter)

5. **Reload your shell:**
   ```bash
   source ~/.zshrc
   ```

6. **Verify tokens are set:**
   ```bash
   echo $GITHUB_PERSONAL_ACCESS_TOKEN
   ```

7. **Restart Claude Code** for changes to take effect

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your `.zshrc` file with real tokens to git
- Add `.zshrc` to your `.gitignore` if it contains tokens
- These tokens give API access to your accounts
- Rotate tokens if they're ever compromised

## Optional: Use a .env file instead

If you prefer not to store tokens in shell config:

1. Install `direnv`: `brew install direnv`
2. Create `~/.env` with your tokens
3. Add `~/.env` to `.gitignore`
4. Add to `~/.zshrc`: `eval "$(direnv hook zsh)"`

## Testing

After setup, verify MCPs are working:

```bash
# In Claude Code terminal
/mcp list  # Should show connected MCPs
```

## Troubleshooting

**If MCPs still fail after setting tokens:**
1. Restart Claude Code completely
2. Verify token has correct permissions
3. Check token hasn't expired
4. Clear MCP cache: `rm ~/.claude/mcp-needs-auth-cache.json`
5. Try again

---

Generated: 2026-03-19
