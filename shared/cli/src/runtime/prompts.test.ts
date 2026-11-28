import { expect, it, vi } from 'vitest';
import { checkbox as checkboxPrompt, select as selectPrompt } from '@inquirer/prompts';
import { checkbox, select } from './prompts.js';
import { getCliTelemetry, withCliTelemetry } from './telemetry.js';
import { RunVerbosity } from './verbosity.js';

vi.mock('@inquirer/prompts', () => ({
    select: vi.fn(),
    checkbox: vi.fn(),
    confirm: vi.fn(),
    input: vi.fn(),
}));

it('suspends progress, supplies cancellation and restores the terminal after prompt failure', async () => {
    await withCliTelemetry('prompt.test', RunVerbosity.Quiet, async () => {
        const runtime = getCliTelemetry()!;
        vi.mocked(selectPrompt).mockImplementationOnce(() => {
            expect(runtime.terminal.isSuspended).toBe(true);
            throw new Error('cancelled');
        });
        await expect(select({ message: 'Choose', choices: [{ value: 'one' }] })).rejects.toThrow(
            'cancelled',
        );
        expect(selectPrompt).toHaveBeenCalledWith(expect.anything(), { signal: runtime.signal });
        expect(runtime.terminal.isSuspended).toBe(false);
    });
});

it('coordinates multiselection and its cancellation signal through the same terminal', async () => {
    await withCliTelemetry('checkbox.test', RunVerbosity.Quiet, async () => {
        const runtime = getCliTelemetry()!;
        vi.mocked(checkboxPrompt).mockImplementationOnce(() => {
            expect(runtime.terminal.isSuspended).toBe(true);
            return Object.assign(Promise.resolve(['artifacts']), { cancel: vi.fn() });
        });
        expect(
            await checkbox({ message: 'Choose targets', choices: [{ value: 'artifacts' }] }),
        ).toEqual(['artifacts']);
        expect(checkboxPrompt).toHaveBeenCalledWith(expect.anything(), { signal: runtime.signal });
        expect(runtime.terminal.isSuspended).toBe(false);
    });
});
