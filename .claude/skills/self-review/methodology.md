# Review methodology

## What to check

Review the changes in scope against these, most important first:

1. **Correctness & bugs** — logic errors, off-by-one, null/undefined,
   unhandled errors, missed edge cases, race conditions, incorrect types. Trace the actual
   data flow; don't assume the code does what its names imply.
2. **Project rules** (from `CLAUDE.md` / `AGENTS.md`):
   - `@stamhoofd/structures` changed without respecting versioning — new fields must be
     additive via `...NextVersion`, never edit `Version.ts`. Flag any change that could break old clients.
   - User-facing strings must be Dutch and wrapped in `$t(...)`. `SimpleError.message` stays
     plain English; `SimpleError.human` uses `$t`.
   - Backend endpoint changes need unit + integration tests; bugfixes need a regression test
     that fails before the fix.
   - Scope creep — the change should touch only the files the task needs.
   - Import style: modern `#`/package exports, no barrel files.
3. **Tests** — are the new/changed behaviors actually covered, and would the tests fail
   *without* the change? Missing or tautological tests are a finding.
4. **Reuse, simplification and maintainability ** — duplicated logic, something that already exists in the
   codebase, needlessly complex code, dead code. Also check the 'Maintainability' section below.
5. **Security** — injection, missing authz/permission checks, leaking data across
   organizations/tenants, unsafe input handling.
6. **Performance** — N+1 queries, work repeated in loops, oversized payloads — only when
   it's a real concern, not speculative.
7. Vue hooks: Any function that calls a hook must also be treated as a hook and start with use. The use prefix may also be added in advance when a function is expected to use hooks later. Only the function that directly calls, or is intended to call, a hook needs the prefix.

## Maintainability

Maintainable code practices

### 1. Optimize for clarity

Code is read far more often than it is written.

Prefer:

- Clear names over abbreviations
- Straightforward control flow over clever one-liners
- Small, focused functions
- Explicit assumptions and constraints
- Consistent patterns across the codebase

A function or class should ideally answer one question or perform one responsibility.

### 2. Keep abstractions proportional to the problem

Avoid both extremes:

- Duplicating complex logic everywhere
- Creating abstractions before there is a clear need

A useful rule is to tolerate small duplication until the shared concept is understood. Similar-looking code does not always represent the same responsibility.

Ask:

- Does this abstraction make the calling code easier to understand?
- Does it hide unnecessary detail?
- Can it evolve without accumulating flags and special cases?

### 3. Separate responsibilities

Keep business logic separate from:

- Database access
- HTTP or UI concerns
- Framework-specific code
- Logging and monitoring
- Serialization
- External integrations

This makes the important behavior easier to test and reduces the impact of infrastructure changes.

### 4. Design clear interfaces

Modules, functions, APIs, and classes should have:

- A narrow purpose
- Minimal inputs
- Predictable outputs
- Explicit failure behavior
- Limited side effects

Avoid functions that both calculate values and unexpectedly mutate unrelated state.

### 5. Write tests around behavior

Tests should protect important behavior, not mirror the implementation line by line.

Include:

- Normal behavior
- Boundary conditions
- Failure cases
- Regression tests for fixed bugs
- Authorization and security-sensitive cases
- Integration tests where components interact
- Important edge cases that might break the code or are hard to reason about

A test suite should make refactoring safer rather than preventing refactoring.

### 6. Keep dependencies and coupling under control

Each new dependency increases maintenance, security, upgrade, and operational costs.

Before adding one, ask:

- Is the problem substantial enough to justify it?
- Is the project actively maintained?
- Is the API stable?
- Could a small local implementation be clearer?
- What is the dependency’s security and licensing impact?

### 7. Document decisions, not obvious syntax

Comments should explain:

- Why a non-obvious approach was chosen
- Important constraints
- Trade-offs
- Workarounds and when they can be removed
- External-system behavior that is not visible in the code

Comments that merely restate the code tend to become outdated.

For significant architectural decisions, use short architecture decision records or equivalent documentation.

### 8. Keep changes small and focused

Smaller PRs are easier to understand and review accurately.

Avoid mixing:

- Functional changes
- Large refactors
- Formatting changes
- Dependency upgrades
- Unrelated cleanup

Sometimes a preparatory refactor should be a separate PR before the behavioral change.

## Output format

Return a concise report:

- **Verdict:** one line — `Ship it`, `Ship with nits`, or `Needs changes`.
- **Blocking** — must fix before merge (correctness, broken project rules, missing required tests).
- **Non-blocking** — recommended doing but not required.
- **Nits** — minor / optional.

For each finding: the `file:line`, a one-sentence explanation, and a concrete suggested
change. Omit any section that has no findings. Don't pad the report.
