## planning — MANDATORY (local Mythos override)

Native plan mode is DISABLED for this project. NEVER call `EnterPlanMode` for any planning-shaped request (feature design, multi-step breakdown, architecture decision, "how should we build X").

Instead, on any planning-shaped request:
1. Gather minimal context yourself (file paths, existing patterns — keep it light).
2. Call `mcp__crm-local-agent__mythos_plan` with `request` (the user's ask) + `context` (what you gathered).
3. Review Mythos's draft plan for correctness/hallucination — Mythos is an uncensored 9B local model, verify file paths and APIs it references actually exist before trusting them.
4. Present the (corrected) plan to the user directly in chat for approval — do NOT use `ExitPlanMode` (that's tied to native plan mode and won't fire here).
5. On approval, implement directly.

If `mythos_plan` tool is unavailable (MCP server not loaded — requires session restart after install) or returns an error, fall back to planning inline yourself and tell the user Mythos was unreachable.

---

## communication — MANDATORY
Caveman ultra active. All responses: ultra-compressed. Drop articles/filler/hedging. Arrows for causality. Abbreviate prose (DB/auth/fn/impl/req/res/config). Code/errors/API names: never abbreviate. Switch off only on destructive-op warnings.

---

## graphify — MANDATORY token-saving protocol

Knowledge graph: `graphify-out/graph.json` (664 nodes, 800 edges, 54 communities).

### REQUIRED order of operations

1. **Before reading ANY source file to answer a question** → run `graphify query "<question>"` first.
2. **Before grepping/searching the codebase** → run `graphify query` or `graphify explain` first.
3. **Only open raw files** when you need to: (a) write/edit code, (b) debug a specific line, or (c) graphify query returned insufficient detail.
4. **After modifying code** → run `graphify update .` (AST-only, free, keeps graph current).

### Commands

| Goal | Command |
|------|---------|
| Answer architecture question | `graphify query "how does X work"` |
| Find where something is defined | `graphify query "where is X defined"` |
| Trace relationship A→B | `graphify path "A" "B"` |
| Deep dive on concept | `graphify explain "concept"` |
| Broad overview | Read `graphify-out/GRAPH_REPORT.md` |
| Wide navigation | Read `graphify-out/wiki/index.md` (if exists) |

### Why

Each `Read` tool call costs tokens. `graphify query` returns a compressed subgraph — 10-50x smaller than reading files. Never read multiple source files to answer a question that graphify can answer in one call.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
