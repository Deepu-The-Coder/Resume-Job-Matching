# Workflow: New Feature

Use this workflow whenever implementing any new backend feature, endpoint, or service.

---

## Steps (execute in order, do not skip)

1. **Read the project rules**
   - Open and re-read `.agent/rules/project-rules.md` in full before writing a single line of code.
   - Confirm the feature fits the defined stack, layering, and conventions.

2. **Write a plan**
   - List every file that will be created or modified.
   - Describe the layering path: which route → controller → service → model is involved.
   - Identify any external calls (LLM, embeddings, Redis) and confirm the correct wrapper module exists or will be created.
   - Note any new environment variables required and where they'll be validated.
   - Get confirmation if the plan deviates from existing patterns.

3. **Implement**
   - Follow the plan exactly.
   - Use ES modules, async/await, small single-purpose files.
   - No business logic in routes. No hardcoded secrets or model names.
   - Add `tenantId` to every new Mongoose document.
   - Use pino for any logging; no `console.log`.

4. **Write tests**
   - Write at least one Vitest + Supertest test for every new endpoint or service function.
   - Mock all external wrapper modules (LLM, embeddings, Redis) — no live API calls in tests.
   - Tests live at `backend/src/__tests__/` or as `*.test.js` siblings to the source file.

5. **Run tests**
   - Run `npm test` from the `backend/` directory.
   - All tests must pass before considering the feature done.
   - Fix any failures before moving on.

6. **Summarize**
   - Produce a short walkthrough:
     - **What changed**: files created/modified.
     - **How to run it**: exact shell commands.
     - **How to verify**: a sample `curl` command or test assertion demonstrating the feature works.
