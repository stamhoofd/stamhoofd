# Shared ESLint configuration

`eslint-plugin-stamhoofd` exports base, backend, frontend, and shared flat configurations.

## Formatting

`pnpm stam check format` uses the syntax-only runner in `bin/format.mjs`. It retains
each file's effective configuration but runs only rules whose metadata declares
`type: 'layout'`, with TypeScript project services disabled. `--fix` applies layout
fixes only. Remaining warnings and syntax errors fail the command; correctness
checks belong to `stam check lint`.

Formatting uses one process and a separate content-based ESLint cache, including a
fingerprint of the local rule implementations. Semantic linting does not use this
per-file cache because imported types can affect unchanged files.

`@stylistic/indent-binary-ops` is disabled in all presets because it conflicts with
`@stylistic/indent` on TypeScript unions (upstream issue #676). Keep `indent` enabled.

## Security diagnostics

All configurations include the upstream recommended presets from `eslint-plugin-secure-coding`, `eslint-plugin-node-security`, and `eslint-plugin-no-unsanitized`, without overriding their severities. Unicorn is limited to `unicorn/no-unsafe-json-serialization`; its broad recommended preset is not enabled. Rules apply globally because browser packages also contain Node scripts and shared libraries can manipulate the DOM. The DOM rules do not check Vue `v-html` expressions.

Findings require review, not every diagnostic is a vulnerability. Generic authentication checks do not establish that Stamhoofd's endpoint classes enforce the correct permissions.

Reviewed false positives use line-level suppressions with the trust boundary documented at the call site. Recommended presets stay enabled globally. These exceptions cover bundled/repository-owned dynamic imports, development credentials, intentional attack and CI-shell fixtures, already escaped XML, plain-text output, and advisory UI checks.

Email editor markup is deliberately rendered as HTML: `EditorView` builds smart variables from application-generated replacements, whose table/login-detail builders escape user values. `EmailStyler.format` receives `editor.getHTML()` from the TipTap schema, not arbitrary HTML. Changes that introduce new replacement producers or raw-HTML callers must preserve those boundaries; `Replacement.getHtmlForWebDisplay()` only rewrites attachment URLs and is not a sanitizer. Translation replacement keys intentionally contain repository-authored regex syntax, so the dynamic-regex diagnostic is suppressed only there.

The shell-command finding in `TranslationManager` is handled separately by `andreasbackx/prevented-injection-translation`; it is not suppressed here. Renderer cache diagnostics remain outside this cleanup. The separate `andreasbackx/logging-dkim-keys` change must likewise not be duplicated.

`pnpm stam check lint` runs the normal errors-only checks. To inspect warnings for a package, use `pnpm --filter <package> exec eslint .`, as documented in the CLI guide. Do not autofix security diagnostics indiscriminately.

Run configuration and custom-rule tests with `pnpm stam test eslint`.
