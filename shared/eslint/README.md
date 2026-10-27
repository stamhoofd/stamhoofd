# Shared ESLint configuration

`eslint-plugin-stamhoofd` exports base, backend, frontend, and shared flat configurations.

## Security diagnostics

All configurations include the upstream recommended presets from `eslint-plugin-secure-coding`, `eslint-plugin-node-security`, and `eslint-plugin-no-unsanitized`, without overriding their severities. Unicorn is limited to `unicorn/no-unsafe-json-serialization`; its broad recommended preset is not enabled. Rules apply globally because browser packages also contain Node scripts and shared libraries can manipulate the DOM. The DOM rules do not check Vue `v-html` expressions.

Findings require review, not every diagnostic is a vulnerability. Generic authentication checks do not establish that Stamhoofd's endpoint classes enforce the correct permissions.

`pnpm stam check lint` runs the normal errors-only checks. To inspect warnings for a package, use `pnpm --filter <package> exec eslint .`, as documented in the CLI guide. Do not autofix security diagnostics indiscriminately.

Run configuration and custom-rule tests with `pnpm stam test eslint`.
