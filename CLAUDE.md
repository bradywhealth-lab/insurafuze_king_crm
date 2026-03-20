# CLAUDE.md — Skills & Agents Reference

This document serves as a master reference for every skill and agent available in this Claude environment. Use it to quickly identify which capability to invoke for any given task.

---

## SKILLS

Skills are specialized instruction sets that guide Claude to produce higher-quality, structured outputs for specific file types or workflows.

| Skill Name | Trigger Phrase(s) | What It Does |
|---|---|---|
| **docx** | "Word doc", ".docx", "write a report/memo/letter" | Creates, reads, edits, and formats Word documents |
| **pdf** | "PDF", ".pdf", "extract from PDF", "merge/split PDF" | Reads, creates, merges, splits, rotates, and performs OCR on PDF files |
| **pptx** | "slides", "deck", "presentation", ".pptx" | Creates, reads, edits, and formats PowerPoint presentations |
| **xlsx** | "spreadsheet", ".xlsx", ".csv", "Excel file" | Opens, creates, edits, and cleans spreadsheet files |
| **product-self-knowledge** | Any question about Claude, Claude API, Claude Code, Claude.ai pricing/features | Looks up accurate Anthropic product facts before responding |
| **frontend-design** | "build a UI", "web component", "landing page", "dashboard" | Creates high-quality production-grade frontend interfaces |
| **doc-coauthoring** | "help me write documentation", "draft a spec/proposal" | Guides structured co-authoring for technical docs and proposals |
| **web-artifacts-builder** | Complex multi-component web apps inside Claude artifacts | Builds elaborate HTML artifacts using React, Tailwind CSS, shadcn/ui |
| **skill-creator** | "create a new skill", "edit a skill", "test a skill" | Creates, modifies, benchmarks, and optimizes skills |
| **theme-factory** | "apply a theme", "style this artifact" | Applies one of 10 preset visual themes to slides, docs, and HTML pages |
| **mcp-builder** | "build an MCP server", "integrate an API via MCP" | Guides creation of Model Context Protocol servers |
| **internal-comms** | "status report", "leadership update", "incident report" | Writes structured internal business communications |
| **canvas-design** | "create a poster", "design an image", "make artwork" | Produces original visual designs as .png and .pdf files |
| **brand-guidelines** | "use Anthropic branding", "apply brand colors" | Applies Anthropic's official colors and typography to any artifact |
| **slack-gif-creator** | "make a GIF for Slack", "animated GIF" | Creates animated GIFs optimized for Slack |
| **algorithmic-art** | "generative art", "algorithmic art", "p5.js" | Creates interactive algorithmic/generative art using p5.js |

---

## AGENTS & TOOLS

### MCP-Connected Services (Live Integrations)

| Agent | What It Does |
|---|---|
| **Google Calendar** | Create, update, delete, and search calendar events |
| **Gmail** | Read, search, draft, and send emails |
| **Google Drive** | Search and retrieve files stored in Google Drive |
| **Canva** | Create, edit, and export Canva designs |
| **Supabase** | Query and manage your Supabase database and storage |
| **Vercel** | Deploy projects, view deployments, check build logs |

### Built-In Claude Tools

| Tool | What It Does |
|---|---|
| **Deep Research** | Runs comprehensive multi-source research tasks across the web |
| **Web Search** | Quick single web searches for current information |
| **Image Search** | Finds relevant images from the web |
| **Google Drive Search** | Searches your personal Google Drive files |
| **Places Search + Map Display** | Searches locations and displays results on an interactive map |
| **Weather** | Fetches current and upcoming weather for any location |
| **Sports Data** | Retrieves live scores, standings, and game stats |
| **Visualizer** | Generates inline SVG diagrams, flowcharts, and interactive widgets |
| **Recipe Display** | Presents recipes with adjustable serving sizes |
| **Message Composer** | Drafts emails, Slack messages, and texts with tone options |
| **Memory Management** | Stores and updates persistent facts across conversations |
| **Conversation Search** | Searches past conversations for previously discussed info |
| **File Creation** | Creates files on the server for download |
| **Desktop Commander** | Accesses and operates your local Mac file system |
| **Claude in Chrome** | Controls a Chrome browser tab — navigates, clicks, fills forms |

---

## SUPERPOWERS — Default Claude Code Framework

> ⚠️ Superpowers runs in Claude Code (terminal) only — NOT in the claude.ai chat window.
> Install it once. After that it loads automatically at every Claude Code session start.

**What it is:** A skills framework that forces your AI coding agent to follow disciplined workflows — planning before coding, test-driven development (TDD), subagent task delegation, and structured code review. Listed in Anthropic's official plugin marketplace.

**GitHub:** https://github.com/obra/superpowers

### One-Time Installation (run inside Claude Code)

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Run these one at a time, in order.

### Slash Commands (inside Claude Code after install)

| Command | What It Does |
|---|---|
| `/superpowers:brainstorm` | Interactive design refinement before touching code |
| `/superpowers:write-plan` | Breaks design into small timed tasks with file paths |
| `/superpowers:execute-plan` | Executes the plan in batches using subagents |

### What It Enforces Automatically

- Plan before code — brainstorm → spec → plan → implement
- TDD — write a failing test first, then write code to pass it
- Subagent isolation — each task runs in its own fresh agent context
- Code review — two-stage review after every task
- Git discipline — branch per task, cleanup on completion

### Things to Know

- Burns through tokens faster than vanilla Claude Code
- Adds 10–20 min of planning overhead upfront, saves time later
- Works in Claude Code only — not Cursor, not this chat

---

## QUICK REFERENCE

| What You Need | Use This |
|---|---|
| Word document | `docx` skill |
| PDF (create or edit) | `pdf` skill |
| PowerPoint deck | `pptx` skill |
| Excel spreadsheet | `xlsx` skill |
| Professional poster or graphic | `canvas-design` skill |
| Diagram or flowchart in chat | Visualizer tool |
| Deep research on a topic | Deep Research tool |
| Schedule a meeting | Google Calendar agent |
| Send or read an email | Gmail agent |
| Deploy or debug a Vercel project | Vercel agent |
| Query or update the CRM database | Supabase agent |
| Build or edit a Canva design | Canva agent |
| Write an internal business update | `internal-comms` skill |
| Build a frontend UI or dashboard | `frontend-design` skill |

---

*Last updated: March 2026*
