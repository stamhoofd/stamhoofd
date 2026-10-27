# Simple errors

`@common/errors` contains the error classes shared by the browser and backend.

```ts
import { SimpleError, SimpleErrors } from '@common/errors';
```

Run `pnpm stam test errors` for tests and `pnpm stam check typecheck @common/errors`
for production and test typechecking. Shared builds produce JavaScript in `dist`
and declarations in `dist-types`.

Errors accepts the structural `ErrorData` decoding contract without depending on
the encoding package. Encoding owns cross-package round-trip tests. The
workspace override for `@simonbackx/simple-errors` redirects unmigrated registry
dependencies to this package so all consumers use the same error implementation.
