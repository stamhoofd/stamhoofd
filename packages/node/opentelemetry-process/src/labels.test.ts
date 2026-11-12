import { trace } from '@opentelemetry/api';
import { afterEach, expect, it, vi } from 'vitest';
import { formatCommandLine, runProcess } from './process.js';

afterEach(() => vi.restoreAllMocks());

it('quotes executable paths, empty arguments, whitespace and shell characters', () => {
    expect(formatCommandLine('/some path/tool', ['status', '', 'two words', '$HOME', 'a"b'])).toBe(
        '"/some path/tool" status "" "two words" "$HOME" "a\\"b"',
    );
});

it.each([undefined, 'Planning secret"value', false] as const)(
    'sanitizes labels before span creation with override %s',
    async (label) => {
        const startSpan = vi.fn(() =>
            trace.wrapSpanContext({
                traceId: '1'.repeat(32),
                spanId: '1'.repeat(16),
                traceFlags: 1,
            }),
        );
        vi.spyOn(trace, 'getTracer').mockReturnValue({ startSpan } as never);
        const messages: string[] = [];
        await runProcess('tool', ['--token', 'secret"value', 'two words'], {
            label,
            redact: ['secret"value'],
            signal: AbortSignal.abort(),
            log: (_level, message) => {
                messages.push(message);
            },
        });
        const attributes = (
            startSpan.mock.calls[0] as unknown as [string, { attributes: Record<string, unknown> }]
        )[1].attributes;
        expect(attributes['operation.label']).toBe(
            label === false
                ? undefined
                : label === undefined
                  ? 'tool --token "[redacted]" "two words"'
                  : 'Planning [redacted]',
        );
        expect(attributes['operation.label.kind']).toBe(
            label === undefined ? 'command' : 'description',
        );
        expect(JSON.stringify(attributes)).not.toContain('secret');
        expect(JSON.stringify(attributes)).not.toContain('\u001b');
        expect(messages.join('')).toContain('tool --token "[redacted]" "two words"');
    },
);

it('records the exit code and failure status for pre-aborted execution', async () => {
    const span = trace.wrapSpanContext({
        traceId: '1'.repeat(32),
        spanId: '1'.repeat(16),
        traceFlags: 1,
    });
    const setAttribute = vi.spyOn(span, 'setAttribute');
    const setStatus = vi.spyOn(span, 'setStatus');
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span);
    const result = await runProcess('nonexistent-executable', [], { signal: AbortSignal.abort() });
    expect(result.code).toBe(130);
    expect(setAttribute).toHaveBeenCalledWith('process.exit.code', 130);
    expect(setStatus).toHaveBeenCalledWith({ code: 2 });
});
