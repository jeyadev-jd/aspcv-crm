---
name: frontend-agent
description: Delegates React/TypeScript UI tasks to local Ollama qwen2.5-coder:7b model. Use for component generation, hook creation, page scaffolding. Claude reviews output before presenting.
---

# Frontend Agent

When user requests React/TypeScript/UI code:

1. Call `rag_query` MCP tool with task description to find relevant files
2. Call `local_code_gen` with agent="frontend" and the full task
3. Review output for: TypeScript correctness, hook patterns, TanStack Query usage, Zustand patterns
4. Fix any issues, then present to user

## Stack Context
- React 19 + TypeScript + Vite
- TanStack Query for server state (useQuery/useMutation)
- Zustand for auth store (src/lib/authStore.ts)
- Axios via src/lib/api.ts
- Inline styles (no Tailwind)
- Lucide React for icons
- Hooks in src/hooks/, pages in src/pages/, shared components in src/components/shared/

## Do NOT generate (always write yourself)
- Security-sensitive auth code
- Complex business logic with multiple edge cases
- Code that modifies Prisma schema
