import readline from 'readline/promises';
import { expect, it, vi } from 'vitest';
import { promptYesNoOrDoubt, YesNoOrDoubt } from './prompt-helper.js';

it('uses the submitted answer without waiting for another keystroke', async () => {
    const terminal = {
        question: vi.fn(async () => 'n'),
        on: vi.fn(),
        close: vi.fn(),
        removeAllListeners: vi.fn(),
        line: 'y',
        input: {
            on: vi.fn((_event: string, callback: () => void) => callback()),
            removeListener: vi.fn(),
        },
    };
    vi.spyOn(readline, 'createInterface').mockReturnValue(terminal as never);
    expect(await promptYesNoOrDoubt('Accept?')).toBe(YesNoOrDoubt.No);
    expect(terminal.input.on).not.toHaveBeenCalled();
    expect(terminal.close).toHaveBeenCalled();
});
