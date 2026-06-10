# ASPCV CRM Skills

Claude skills integrated from [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) to extend CRM capabilities.

## Quick Start

These skills are available in Claude Code and Claude.ai. Use by name:

```
/lead-research-assistant
Find me 20 qualified leads in India for heat pump solutions
```

## Included Skills

1. **lead-research-assistant/** — Find qualified leads by ICP
2. **document-skills/** — Parse DOCX, PDF, XLSX, PPTX files
3. **file-organizer/** — Organize files hierarchically
4. **invoice-organizer/** — Extract and track invoices
5. **googledrive-automation/** — Manage Google Drive files
6. **slackbot-automation/** — Send Slack notifications
7. **mcp-builder/** — Build MCP servers for CRM API
8. **skill-creator/** — Create custom skills

See [CLAUDE_SKILLS_INTEGRATION.md](../CLAUDE_SKILLS_INTEGRATION.md) for detailed setup and usage.

## Skill Usage in Claude Code

### Example 1: Research Leads
```
/lead-research-assistant
I'm ASPCV, selling heat pump solutions. Find me 15 qualified leads in Tamil Nadu and Karnataka 
that need industrial cooling solutions. Include decision-maker roles and outreach strategies.
```

### Example 2: Organize Documents
```
/file-organizer
Organize all files for Lead [ID] into: Proposals, Contracts, Communications, Invoices
```

### Example 3: Process Invoice
```
/invoice-organizer
Extract amount, terms, and due date from this invoice. 
Create timeline event in Deal [ID] and update budget.
```

## Configuration

Optional environment variables for integrations:

```bash
# Google Drive
export GOOGLE_DRIVE_API_KEY=<your-api-key>

# Slack
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
```

## Next Steps

- [ ] Test `/lead-research-assistant` to find leads
- [ ] Set up Google Drive integration (optional)
- [ ] Set up Slack bot (optional)
- [ ] Build custom MCP server for CRM API (Phase 3)

See [../CLAUDE_SKILLS_INTEGRATION.md](../CLAUDE_SKILLS_INTEGRATION.md) for full details.
