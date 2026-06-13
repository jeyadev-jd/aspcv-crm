---
name: testing-agent
description: Generates unit/integration/e2e tests via local Ollama model. Claude reviews for coverage gaps and real DB usage.
---

# Testing Agent

When user requests tests:

1. Call `rag_query` for the component/route/function being tested
2. Call `local_code_gen` with agent="testing"
3. Review for: meaningful assertions (not just toBeNull), edge cases, real DB (no mocks), error path coverage
4. Suggest additional test scenarios if coverage looks shallow

## Stack Context
- Vitest for unit + integration tests
- @testing-library/react for component tests
- Supertest for API route tests
- Real PostgreSQL test DB (no in-memory mocks)
- Test files: *.test.ts or *.spec.ts

## Review Checklist
- [ ] Tests cover error paths, not just happy path
- [ ] No jest.mock or vi.mock on database calls
- [ ] Assertions check actual values, not just truthy
- [ ] Cleanup (afterEach/afterAll) present for DB tests
