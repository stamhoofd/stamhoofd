import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { command, info, success } from '../runtime/ux.js';

export const SHELL_SNIPPET_START = '# >>> stam cli >>>';
export const SHELL_SNIPPET_END = '# <<< stam cli <<<';

/**
 * A shell function that resolves `stam` to the CLI inside whatever Stamhoofd
 * clone or worktree the current directory belongs to. It walks up the directory
 * tree from $PWD until it finds shared/cli/bin/stam.js, so the same `stam`
 * command always runs the right checkout — including from any subdirectory. If
 * that checkout has never been built, it builds the CLI once before running.
 */
export function buildShellSnippet(): string {
    return [
        SHELL_SNIPPET_START,
        '# Resolves `stam` to the CLI inside whatever Stamhoofd clone or worktree you are in.',
        'stam() {',
        '    local dir="$PWD"',
        '    while [ -n "$dir" ]; do',
        '        if [ -f "$dir/shared/cli/bin/stam.js" ]; then',
        '            if [ ! -f "$dir/shared/cli/dist/index.js" ]; then',
        '                echo "stam: building CLI in $dir/shared/cli (first run)…" >&2',
        '                yarn --cwd "$dir/shared/cli" -s build || return $?',
        '            fi',
        '            "$dir/shared/cli/bin/stam.js" "$@"',
        '            return $?',
        '        fi',
        '        dir="${dir%/*}"',
        '    done',
        '    echo "stam: not inside a Stamhoofd repository (no shared/cli/bin/stam.js found above $PWD)" >&2',
        '    return 1',
        '}',
        SHELL_SNIPPET_END,
    ].join('\n');
}

export type ShellKind = 'zsh' | 'bash';

export function detectShellKind(shellPath: string | undefined): ShellKind {
    if (shellPath && path.basename(shellPath).includes('bash')) {
        return 'bash';
    }
    return 'zsh';
}

export function defaultRcFile(shell: ShellKind, home: string = os.homedir()): string {
    return path.join(home, shell === 'bash' ? '.bashrc' : '.zshrc');
}

export type InstallShellResult = {
    rcFile: string;
    action: 'created' | 'updated' | 'unchanged';
};

/**
 * Inserts or refreshes the `stam` shell function in the given rc file. The block
 * is delimited by marker comments so repeated runs stay idempotent and never
 * duplicate the function.
 */
export async function installShellFunction(rcFile: string): Promise<InstallShellResult> {
    const snippet = buildShellSnippet();

    let existing = '';
    let fileExists = true;
    try {
        existing = await fs.readFile(rcFile, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        fileExists = false;
    }

    const startIndex = existing.indexOf(SHELL_SNIPPET_START);
    const endIndex = existing.indexOf(SHELL_SNIPPET_END);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const before = existing.slice(0, startIndex);
        const after = existing.slice(endIndex + SHELL_SNIPPET_END.length);
        const next = `${before}${snippet}${after}`;
        if (next === existing) {
            return { rcFile, action: 'unchanged' };
        }
        await fs.writeFile(rcFile, next);
        return { rcFile, action: 'updated' };
    }

    const block = `${existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''}${existing.length > 0 ? '\n' : ''}${snippet}\n`;
    await fs.writeFile(rcFile, `${existing}${block}`);
    return { rcFile, action: fileExists ? 'updated' : 'created' };
}

/**
 * Sets up the `stam` shell shortcut so you can drop the `yarn` prefix. With
 * dryRun, prints the snippet instead of editing any file.
 */
export async function setupShellShortcut(options: { dryRun?: boolean; shell?: ShellKind } = {}): Promise<void> {
    if (options.dryRun) {
        info(buildShellSnippet());
        return;
    }

    const shell = options.shell ?? detectShellKind(process.env.SHELL);
    const rcFile = defaultRcFile(shell);
    const result = await installShellFunction(rcFile);

    if (result.action === 'unchanged') {
        success(`\`stam\` shortcut is already installed in ${result.rcFile}`);
    } else {
        success(`${result.action === 'created' ? 'Created' : 'Updated'} ${result.rcFile} with the \`stam\` shell function`);
    }

    info('');
    info('Restart your terminal or reload your shell to start using it:');
    info(`  ${command(`source ${result.rcFile}`)}`);
    info('');
    info(`Then run ${command('stam --help')} from anywhere inside a Stamhoofd repository.`);
}
