# Development guidelines

## Ask questions early

Ask before spending a long time debugging an unfamiliar subsystem or guessing an undocumented contract. Explain what you are trying to do, what you expected, and what you observed. Read the relevant repository documentation and owning code first; ask for recommendations before starting complex work.

Team discussion happens in Slack (invitation only). External contributors can also contact **support@stamhoofd.be**. Do not post credentials, private customer data, or local certificate/key bundles when asking for help.

## Make changes easy to review

- Keep changes focused. Never modify files unrelated to the task or discard another contributor's work.
- Split work into small, working commits that can be validated independently.
- Do not refactor everything at once. If a refactor is necessary, make it a small, separate commit before the feature or fix; do not bundle unrelated cleanup into either.
- Write a technical specification for complex features before implementing them. Keep contributor-facing design decisions and implementation guidance in repository documentation, with API contracts beside the owning code and cross-package workflows in `contributing/`. Keep unfinished proposals explicitly marked WIP/TODO.
- Prefer integrating small, working pieces behind feature flags over long-running feature branches. A flag is not a reason to skip tests or review; do not add a flag without a feature that needs it.
- Keep history linear: rebase rather than creating merge commits. Learn how to resolve conflicts and review the resulting changes.

Use `jj` when the checkout is a Jujutsu repository. Otherwise use Git. CLI tools are recommended, especially for understanding and resolving conflicts, but the choice of interface is not itself a requirement.

## Write clear commit messages

Use a past-tense summary of at most **80 characters**. Leave the second line blank, reference the associated issue when there is one, and explain the context and motivation rather than repeating the diff:

```text
Fixed incorrect stock reservation

fixes #STA-ID
Explain why the change was needed and any important tradeoff.
```

Use `ref #STA-ID`, `fixes #STA-ID`, or `closes #STA-ID` as appropriate; omit the reference if there is no issue. For user-facing changes, prepend a [gitmoji](https://gitmoji.dev/) emoji to the summary. Alpha-feature commits need no emoji.

| Emoji | Use |
| --- | --- |
| ✨ | Feature |
| 🎨 | Improvement or change |
| 🐛 | Bug fix |
| 💡 | Other information relevant to users or release notes |

Keep refactoring, feature/fix work, and generated release/translation updates separate so reviewers and release-note writers can identify each change.

## Test the behavior you change

For a bugfix, **write a regression test first**, run it to verify that it fails for the intended reason, and commit it as proof of the bug. Then fix the implementation in a following commit and verify that the same test passes. Keep the regression test.

- Cover the most important happy path and a failure path for features. New UI views need Playwright coverage of the key happy path.
- Test critical or complex paths that another contributor could break without knowing the surrounding context.
- Use unit tests for complex classes and reusable building blocks.
- Test permissions, including unauthorized access. UI gating does not replace backend authorization.
- Backend endpoint changes need unit and integration tests. Cover multiple situations with focused tests rather than one enormous test.

Follow [AGENTS.md](../AGENTS.md) for repository-specific requirements and the [CLI test guide](../shared/cli/README.md#tests) for available options. From the repository root, the final checks are:

```sh
pnpm run lint
pnpm run typecheck
pnpm stam test unit
```

Use `pnpm stam test api` for focused API tests and `pnpm stam test e2e` for Playwright. The CLI owns shared builds, isolated database setup, migrations, environment configuration, and teardown. Do not provision an alternative test database or invoke/build Playwright manually. On infrastructure problems, stop and ask for help; do not present a failed or skipped check as successful.

Shared packages are consumed through built `dist/` output. For development after shared source changes, follow the build-order instructions in [AGENTS.md](../AGENTS.md); the test CLI performs its own prerequisite builds.
