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
