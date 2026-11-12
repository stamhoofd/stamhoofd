import { expectTypeOf, it } from 'vitest';
import type { ProcessOptions } from './process.js';

// eslint-disable-next-line vitest/expect-expect -- These assertions are checked by TypeScript rather than at runtime.
it('distinguishes passthrough, inherited stdin and piped input at compile time', () => {
    expectTypeOf<{ inheritStdio: true }>().toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{ inheritStdin: true; capture: true }>().toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{ input: string; capture: true }>().toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{ inheritStdio: true; capture: true }>().not.toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{
        inheritStdio: true;
        sanitizeStdout: (text: string) => string;
    }>().not.toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{ inheritStdio: true; input: string }>().not.toMatchTypeOf<ProcessOptions>();
    expectTypeOf<{ inheritStdin: true; input: string }>().not.toMatchTypeOf<ProcessOptions>();
});
