import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSudo } from '../runtime/process.js';
import { command, info, success } from '../runtime/ux.js';
import { homebrewCompletionGuidance, shellCompletionFiles, shellCompletionPaths } from './shell-completions.js';

export async function checkShellShortcut(): Promise<{ ok: boolean; details: string }> {
    try {
        await fs.access('/usr/local/bin/stam', constants.X_OK);
        const source = fileURLToPath(new URL('../../bin/stam', import.meta.url));
        const [installed, current] = await Promise.all([
            // eslint-disable-next-line node-security/no-toctou-vulnerability -- Read-only diagnostic of a root-owned install path; the check result is never used for access decisions, and ENOENT/EACCES are handled below.
            fs.readFile('/usr/local/bin/stam'),
            fs.readFile(source),
        ]);
        if (!installed.equals(current)) {
            return { ok: false, details: '/usr/local/bin/stam is out of date' };
        }
        const completions = await shellCompletionFiles().catch((error: unknown) => {
            return error instanceof Error ? error : new Error(String(error));
        });
        if (completions instanceof Error) return { ok: false, details: `Could not check shell completion: ${completions.message}${process.platform === 'darwin' ? `. ${homebrewCompletionGuidance}` : ''}` };
        for (const file of completions) {
            const installed = await fs.readFile(file.destination, 'utf8').catch((error: NodeJS.ErrnoException) => {
                if (error.code === 'ENOENT' || error.code === 'EACCES') return undefined;
                throw error;
            });
            if (installed !== file.contents) return { ok: false, details: `${file.destination} is missing, unreadable or out of date` };
        }
        return { ok: true, details: `stam and Bash/Zsh completion installed${process.platform === 'darwin' ? `. ${homebrewCompletionGuidance}` : ''}` };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return { ok: false, details: 'stam not installed in /usr/local/bin' };
        }
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
            return { ok: false, details: '/usr/local/bin/stam is not executable' };
        }
        throw error;
    }
}

export async function removeLegacyShellFunction(rcFile: string): Promise<boolean> {
    let existing: string;
    try {
        existing = await fs.readFile(rcFile, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return false;
        }
        throw error;
    }

    const next = existing.replace(/^# >>> stam cli >>>\r?\n[\s\S]*?^# <<< stam cli <<<\r?\n?/gm, '');
    if (next === existing) {
        return false;
    }
    await fs.writeFile(rcFile, next);
    return true;
}

export async function setupShellShortcut(options: { dryRun?: boolean } = {}): Promise<void> {
    const source = fileURLToPath(new URL('../../bin/stam', import.meta.url));
    const destination = '/usr/local/bin/stam';
    const rcFiles = ['.zshrc', '.bashrc'].map(name => path.join(os.homedir(), name));
    const directoryExists = await fs.stat(path.dirname(destination)).then(stat => stat.isDirectory(), (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false;
        throw error;
    });

    if (options.dryRun) {
        if (!directoryExists) info(command('sudo mkdir -p /usr/local/bin'));
        info(command(`sudo install -m 755 "${source}" ${destination}`));
        for (const file of Object.values(await shellCompletionPaths())) info(`Install standalone completion (mode 644) at ${file}`);
        info(`Remove legacy stam shell functions from ${rcFiles.join(' and ')} if present.`);
        return;
    }

    const completions = await shellCompletionFiles();
    if (!directoryExists) await execSudo(['mkdir', '-p', '/usr/local/bin']);
    await execSudo(['install', '-m', '755', source, destination]);
    success(`Installed ${destination}`);

    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-completions-'));
    try {
        for (const [index, file] of completions.entries()) {
            const source = path.join(temporary, String(index));
            await fs.writeFile(source, file.contents, { mode: 0o600 });
            await execSudo(['mkdir', '-p', path.dirname(file.destination)]);
            await execSudo(['install', '-m', '644', source, file.destination]);
            success(`Installed ${file.destination}`);
        }
    } finally {
        await fs.rm(temporary, { recursive: true, force: true });
    }
    if (process.platform === 'darwin') info(homebrewCompletionGuidance);

    let removed = false;
    for (const rcFile of rcFiles) {
        if (await removeLegacyShellFunction(rcFile)) {
            success(`Removed legacy stam shell function from ${rcFile}`);
            removed = true;
        }
    }
    if (removed) {
        info(`Restart your terminal or run ${command('unset -f stam')} to remove the old function from this shell.`);
    }
    info(`Run ${command('stam --help')} from anywhere inside a Stamhoofd repository.`);
}
