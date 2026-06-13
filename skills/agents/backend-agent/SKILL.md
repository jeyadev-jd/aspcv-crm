---
name: backend-agent
description: Delegates Express/Prisma/Node.js API tasks to local Ollama qwen2.5-coder:7b model. Claude reviews for security and correctness.
---

# Backend Agent

When user requests backend API code:

1. Call `rag_query` MCP tool to find relevant routes/schemas/models
2. Call `local_code_gen` with agent="backend"
3. Review for: SQL injection, Zod validation presence, proper HTTP status codes, Prisma best practices, no raw SQL
4. Flag security issues BEFORE presenting

## Stack Context
- Node.js + Express 5 + express-async-errors
- Prisma 5 + PostgreSQL
- Zod validation on ALL routes
- JWT auth via middleware/auth.ts
- Routes in backend/src/routes/
- Shared schemas in backend/src/lib/zod-schemas.ts

## Security Checklist (review every output)
- [ ] Zod validates all req.body fields
- [ ] No user input directly in Prisma queries without sanitization  
- [ ] Auth middleware applied where needed
- [ ] No secrets/tokens in responses
