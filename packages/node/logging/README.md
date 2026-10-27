# Simple logging

Helper library for nice, styleable and context aware logging.

This is the private Node.js workspace `@node/logging`. Declare it as
`"@node/logging": "workspace:*"` in consuming packages. It uses Node's
`AsyncLocalStorage` and process streams; it is not a browser library.

`Logger` writes to injected streams and isolates prefixes and tags through
`setContext`. `StyledText` applies styles and tags; the exported `logger` uses
the process streams. Importing the package does not replace console methods;
`infectConsole()` does that explicitly.

Run `pnpm stam test node-logging`, `pnpm stam check lint @node/logging`, and
`pnpm stam check typecheck @node/logging` from the repository root. Builds emit
runtime JavaScript into `dist` and declarations into `dist-types`, retaining
the original assignment-style class fields and Chalk 4 dependency.

The Stamhoofd-specific logging wrapper remains `@stamhoofd/logging` in
`backend/shared/logging`; `pnpm stam test logging` still selects its tests.
