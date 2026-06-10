# ASPCV CRM — Claude Skills Integration Guide

Integrated skills from [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) to extend CRM capabilities.

## Skills Included

### 1. **Lead Research Assistant** (`lead-research-assistant/`)
**Purpose**: Identify high-quality leads matching ideal customer profile.

**CRM Integration**: 
- Use with **Leads page** to research and qualify new prospects
- Analyzes company fit, identifies decision-makers, suggests outreach strategies
- Command: Describe product/service → get 10-20 qualified leads with contact strategies

**Example Usage**:
```
I'm selling heat pump solutions for HVAC and industrial cooling. 
Find me 15 qualified leads in North India (Tamil Nadu, Karnataka, Maharashtra) 
that would benefit from this. Include company size, industry, decision-maker roles, and outreach strategies.
```

---

### 2. **Document Skills** (`document-skills/`)
**Purpose**: Process and manage documents (DOCX, PDF, XLSX, PPTX).

**CRM Integration**:
- Parse **Attachments** on Discussion/Timeline
- Extract data from customer proposals, contracts, invoices
- Convert between formats for reporting
- Subfolders: `docx/`, `pdf/`, `xlsx/`, `pptx/`

**Example Usage**:
```
Extract contact information and order details from this PDF proposal.
Convert to structured lead data for CRM import.
```

---

### 3. **File Organizer** (`file-organizer/`)
**Purpose**: Organize and manage files hierarchically.

**CRM Integration**:
- Auto-organize discussion attachments by lead/deal/project
- Create folder structure: `Lead/[Lead ID]/Documents/[Type]/`
- Maintain attachment archive with metadata

**Example Usage**:
```
Organize all files for Lead [ID] into folders: Proposals, Contracts, Communications, Invoices.
```

---

### 4. **Invoice Organizer** (`invoice-organizer/`)
**Purpose**: Process and track invoices.

**CRM Integration**:
- Link invoices to deals/projects via **Timeline**
- Extract payment terms, amounts, dates
- Track invoice status (draft → sent → paid)
- Auto-update deal/project budget tracking

**Example Usage**:
```
This is an invoice from lead/deal [ID]. Extract amount, terms, and due date. 
Create timeline event and update deal budget.
```

---

### 5. **Google Drive Automation** (`googledrive-automation/`)
**Purpose**: Manage files on Google Drive.

**CRM Integration**:
- Store attachments on Google Drive instead of local storage
- Implement `SharePointFileStorage` interface via GDrive
- Create project/deal folders automatically
- Share documents with team members

**Prerequisites**: 
- Google Cloud API credentials
- Service account with Drive API enabled

**Setup**: 
```bash
export GOOGLE_DRIVE_API_KEY=<your-api-key>
```

---

### 6. **Slack Bot Automation** (`slackbot-automation/`)
**Purpose**: Send notifications and updates to Slack.

**CRM Integration**:
- Alert sales team when lead status changes (e.g., Order Won → Deal)
- Notify on new discussion/activity
- Post deal milestones to team channels
- Create Slack threads for lead discussions

**Prerequisites**: 
- Slack workspace + bot token
- Channel setup: `#leads`, `#deals`, `#projects`, `#alerts`

**Setup**:
```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
```

**Example Message**:
```
📊 Lead Updated: [Lead Name] → Order Won
💼 Promoted to Deal: [Deal Name]
👤 Owner: [Sales Person]
🎯 Estimated Value: ₹[amount]
```

---

### 7. **MCP Builder** (`mcp-builder/`)
**Purpose**: Create custom Model Context Protocol (MCP) servers.

**CRM Integration**:
- Build MCP server to expose CRM API to Claude
- Tools: fetch leads, update deal status, create discussions, search timeline
- Deploy as local service for Claude Code access

**Example MCP Tool**:
```typescript
// mcp-tool: get-lead
GET /api/leads/:id → Lead with full details
Params: id (lead ID)
Returns: Lead object with contacts, sources, discussions
```

---

### 8. **Skill Creator** (`skill-creator/`)
**Purpose**: Create new custom Claude skills.

**CRM Integration**:
- Template for building CRM-specific skills
- Example: "lead-qualification-helper", "deal-forecast-analyzer", "contact-enrichment-tool"
- Structure: SKILL.md + optional scripts/references

---

## How to Use Skills in Claude Code

### Basic Usage
Skills load automatically in Claude Code. Reference by folder name:

```
/lead-research-assistant
Find me leads matching this ICPDescription
```

### With CRM Data
Run from CRM directory for context:

```
# In VSCode terminal at /home/jeyadev/ASPCV CRM/
claude

# Then in Claude Code:
/lead-research-assistant
Our ASPCV CRM sells heat pump solutions. Find 20 leads in India.
```

### Combining Skills
Chain multiple skills for complex tasks:

1. `/lead-research-assistant` → research qualified leads
2. `/googledrive-automation` → create lead folder on GDrive
3. `/slackbot-automation` → notify #leads channel with results
4. Import leads into CRM via API

---

## Integration with CRM Modules

| Skill | Module | Use Case |
|-------|--------|----------|
| lead-research | Leads | Find new prospects |
| document-skills | Attachments/Timeline | Parse contracts, proposals |
| file-organizer | Attachments | Auto-organize by lead/deal |
| invoice-organizer | Deals/Projects | Track payments, invoices |
| googledrive | Attachments | Store files on GDrive |
| slackbot | Timeline/Notifications | Alert team on updates |
| mcp-builder | API | Expose CRM to Claude |

---

## Setup Checklist

- [ ] Skills copied to `./skills/` (done)
- [ ] Read each SKILL.md for details
- [ ] Set up Google Drive API (optional, for file storage)
- [ ] Set up Slack bot token (optional, for notifications)
- [ ] Test `/lead-research-assistant` skill
- [ ] Deploy MCP server for CRM API access (Phase 3)

---

## Next Steps

1. **Immediate**: Test `/lead-research-assistant` to find leads for ASPCV
2. **Short-term**: Wire Google Drive + Slack integrations
3. **Medium-term**: Build custom MCP server to expose CRM API
4. **Long-term**: Create domain-specific skills (deal forecasting, contact enrichment, etc.)

---

## References

- [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [Claude Skills Format](https://github.com/anthropics/skills)
- [Composio Docs](https://docs.composio.dev/)
- [MCP Protocol](https://modelcontextprotocol.io/)
