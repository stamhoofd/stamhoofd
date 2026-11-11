import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from '../runtime/process.js';

export const homebrewCompletionGuidance = 'Enable Homebrew shell completion: https://docs.brew.sh/Shell-Completion';

/** Resolve platform-owned search paths without assuming an Intel or Apple Silicon Homebrew prefix. */
export async function shellCompletionPaths(): Promise<{ bash: string; zsh: string }> {
    if (process.platform === 'darwin') {
        const { stdout } = await exec('brew', ['--prefix'], { capture: true, label: false });
        const prefix = stdout.trim();
        if (!path.isAbsolute(prefix)) throw new Error('Homebrew did not return an absolute prefix. Install Homebrew before setting up shell completion.');
        return { bash: path.join(prefix, 'etc/bash_completion.d/stam'), zsh: path.join(prefix, 'share/zsh/site-functions/_stam') };
    }
    if (process.platform !== 'linux') throw new Error('Shortcut shell completion supports Linux and macOS.');
    return { bash: '/usr/share/bash-completion/completions/stam', zsh: '/usr/share/zsh/site-functions/_stam' };
}

/** Use the same export as the public completion command, without starting another build. */
export async function shellCompletionFiles(): Promise<{ destination: string; contents: string }[]> {
    const paths = await shellCompletionPaths();
    const files: { destination: string; contents: string }[] = [];
    for (const shell of ['bash', 'zsh'] as const) {
        const result = await exec(process.execPath, [fileURLToPath(new URL('../../bin/stam.js', import.meta.url)), 'completion', shell, '--standalone'], { capture: true, label: false });
        files.push({ destination: paths[shell], contents: result.stdout });
    }
    return files;
}
