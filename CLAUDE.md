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
