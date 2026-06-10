# ASPCV CRM — Complete Skills Index

86 Claude Skills for CRM development, organized by role/expertise.

## Usage in Claude Code

Invoke any skill by name:
```
/system-architect
Design the database schema for multi-tenant lead management
```

Or combine multiple skills for complex tasks:
```
/product-manager
What features should we prioritize for Q3?

/backend-engineer
How should we implement those features?

/code-reviewer
Review my implementation for issues
```

---

## Skills by Category

### 🏗️ Architecture & Planning (7)
- `/system-architect` — Enterprise CRM system architecture, scalability, components
- `/solution-architect` — Comprehensive CRM solutions, tech stack, roadmaps
- `/product-manager` — Features, prioritization, requirements, roadmaps
- `/business-analyst` — Requirements analysis, use cases, specifications
- `/technical-lead` — Technical decisions, code review, architecture validation
- `/saas-architect` — Multi-tenant licensing, onboarding, SaaS features
- `/multi-tenant-architect` — Data isolation, tenancy models, schema design

### 🎨 Frontend (8)
- `/react-developer` — React components, state, performance, features
- `/ui-engineer` — Reusable components, design systems, libraries
- `/ux-designer` — User flows, wireframes, accessibility, UX patterns
- `/dashboard-builder` — Analytics dashboards, visualizations, KPIs
- `/data-table-specialist` — Sortable/filterable tables, large datasets
- `/form-builder` — Forms, validation, complex logic
- `/state-management-expert` — Zustand, TanStack Query, data flow
- `/accessibility-expert` — WCAG compliance, keyboard nav, a11y audit

### 🔧 Backend (7)
- `/backend-engineer` — API endpoints, business logic, error handling
- `/api-engineer` — RESTful APIs, versioning, documentation
- `/nodejs-expert` — Optimize async, streams, performance
- `/authentication-specialist` — JWT, OAuth, sessions, token handling
- `/authorization-specialist` — RBAC, permissions, policy enforcement
- `/microservices-architect` — Service decomposition, inter-service communication
- `/integration-engineer` — Third-party integrations, webhooks, API clients

### 🗄️ Database (5)
- `/database-architect` — PostgreSQL schema, normalization, indexing
- `/postgresql-expert` — Query optimization, procedures, tuning
- `/query-optimization-expert` — Slow query analysis, indexes, N+1 fixes
- `/data-modeling-expert` — Efficient models, relationships, constraints
- `/migration-specialist` — Safe migrations, transformations, rollbacks

### 🔒 Security (5)
- `/security-auditor` — Vulnerability audits, threat modeling, risk assessment
- `/rbac-specialist` — Role-based access control, permissions, scope
- `/jwt-specialist` — JWT tokens, signing, validation, refresh
- `/owasp-security-expert` — OWASP top 10, secure coding
- `/compliance-specialist` — GDPR/HIPAA compliance, privacy, audit logging

### 💼 CRM Domain (9)
- `/crm-architect` — Complete CRM design, data models, workflows
- `/lead-management-specialist` — Lead workflows, scoring, lifecycle
- `/contact-management-specialist` — Contact data, deduplication, enrichment
- `/account-management-specialist` — Account structures, hierarchies
- `/deal-pipeline-specialist` — Deal pipelines, stages, forecasting
- `/activity-tracking-specialist` — Activity logging, timeline, audit trails
- `/task-management-specialist` — Task workflows, reminders, assignments
- `/workflow-automation-specialist` — Automation rules, triggers, actions
- `/customer-success-specialist` — Onboarding, success metrics, retention

### 📊 Microsoft 365 (5)
- `/microsoft-365-integration-expert` — Office 365 services, auth, sync
- `/outlook-integration-expert` — Calendar, email, contacts sync
- `/teams-integration-expert` — Teams bots, integrations, notifications
- `/calendar-sync-expert` — Calendar data, meeting tracking, availability
- `/graph-api-expert` — Microsoft Graph API data access

### 🚀 DevOps & Deployment (6)
- `/devops-engineer` — Deployment pipelines, infrastructure, automation
- `/aws-architect` — AWS infrastructure, services, scaling, cost
- `/docker-expert` — Dockerfiles, optimization, orchestration
- `/ci-cd-engineer` — GitHub Actions, testing, deployment
- `/monitoring-specialist` — Logging, monitoring, alerting, observability
- `/performance-engineer` — Bottleneck identification, profiling, load testing

### ✅ Quality Assurance (6)
- `/code-reviewer` — Code quality, security, best practices, style
- `/qa-engineer` — Test strategies, edge cases, regression
- `/unit-test-generator` — Unit tests, coverage, mocks
- `/integration-test-engineer` — Integration tests, API, database
- `/e2e-test-engineer` — End-to-end tests, user flows, UI automation
- `/bug-hunter` — Bug finding, test cases, edge cases

### 📝 Documentation (4)
- `/technical-writer` — Architecture docs, guides, README, runbooks
- `/api-documentation-writer` — API endpoints, formats, examples
- `/database-documentation-writer` — Schema, relationships, indexes
- `/user-documentation-writer` — User guides, tutorials, help articles

### ⚡ Performance (4)
- `/performance-optimizer` — Overall system performance, bottlenecks
- `/frontend-performance-expert` — React, bundle size, rendering, assets
- `/backend-performance-expert` — API responses, queries, caching
- `/database-performance-expert` — Query optimization, indexes, schema

### 📈 Data & Analytics (4)
- `/reporting-specialist` — Reports, dashboards, data export
- `/analytics-engineer` — Analytics schema, event tracking, metrics
- `/dashboard-analytics-expert` — Interactive dashboards, visualizations
- `/kpi-specialist` — KPI definition, metrics, performance tracking

### 🤖 AI Features (4) [Future]
- `/ai-crm-assistant` — AI-powered features, LLM integration
- `/recommendation-engine-specialist` — Lead/contact recommendations
- `/nlp-specialist` — Email parsing, entity extraction, sentiment
- `/agent-workflow-designer` — Multi-step workflows, decision trees

### 🔧 Maintenance (4)
- `/refactoring-expert` — Code quality, duplication, clarity
- `/technical-debt-auditor` — Technical debt, prioritization, remediation
- `/dependency-manager` — Dependency updates, conflicts
- `/codebase-maintainer` — Code quality, consistency, standards

---

## Special Skills (8) [From awesome-claude-skills]
- `/lead-research-assistant` — Research qualified leads by ICP
- `/document-skills` — Parse DOCX, PDF, XLSX, PPTX
- `/file-organizer` — Organize files hierarchically
- `/invoice-organizer` — Extract & track invoices
- `/googledrive-automation` — Google Drive file management
- `/slackbot-automation` — Slack notifications
- `/mcp-builder` — Build MCP servers for CRM API
- `/skill-creator` — Create custom skills

---

## Quick Commands

### Planning a Feature
```
/product-manager
What features should we build for lead automation?

/crm-architect
How should we design the database for this?

/technical-lead
What's the technical approach?
```

### Code Review
```
/code-reviewer
Review my changes for issues

/security-auditor
Are there any security concerns?

/performance-optimizer
Is this performant?
```

### Implementation
```
/backend-engineer
Implement the API endpoints

/react-developer
Build the UI components

/database-architect
Optimize the queries
```

### Deployment
```
/devops-engineer
Set up deployment pipeline

/monitoring-specialist
Configure logging and alerting

/performance-engineer
Identify bottlenecks
```

---

## Tips

1. **Chain Skills** — Use multiple skills for complex tasks
2. **Be Specific** — Give context about what you're working on
3. **Ask for Trade-offs** — Ask specialists to explain tradeoffs
4. **Get Second Opinions** — Use different specialists to review work
5. **Focus Domain** — Most specialists are CRM-focused

---

## Total: 86 Skills

- 8 Utility skills (awesome-claude-skills)
- 78 Specialist skills
- 100% ASPCV CRM focused
- Organized by 14 categories

Ready to use. Start with `/system-architect` or your domain of interest.
