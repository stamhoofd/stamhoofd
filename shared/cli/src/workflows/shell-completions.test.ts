import { afterEach, describe, expect, it, vi } from 'vitest';
import { exec } from '../runtime/process.js';
import { shellCompletionPaths } from './shell-completions.js';

vi.mock('../runtime/process.js', () => ({ exec: vi.fn() }));

const platform = process.platform;
afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
    vi.restoreAllMocks();
});

describe('shell completion destinations', () => {
    it('uses Linux vendor directories without requiring Homebrew', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        expect(await shellCompletionPaths()).toEqual({
            bash: '/usr/share/bash-completion/completions/stam',
            zsh: '/usr/share/zsh/site-functions/_stam',
        });
    });

    it.each(['/opt/homebrew', '/usr/local'])(
        'uses the actual Homebrew prefix %s',
        async (prefix) => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            vi.mocked(exec).mockResolvedValueOnce({ stdout: `${prefix}\n` } as never);
            expect(await shellCompletionPaths()).toEqual({
                bash: `${prefix}/etc/bash_completion.d/stam`,
                zsh: `${prefix}/share/zsh/site-functions/_stam`,
            });
            expect(exec).toHaveBeenCalledWith('brew', ['--prefix'], {
                capture: true,
                label: false,
            });
        },
    );
});
