import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { command, info, success } from '../runtime/ux.js';

export async function checkShellShortcut(): Promise<{ ok: boolean; details: string }> {
    try {
        await fs.access('/usr/local/bin/stam', constants.X_OK);
        return { ok: true, details: 'stam installed in /usr/local/bin' };
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

    if (options.dryRun) {
        info(command('sudo mkdir -p /usr/local/bin'));
        info(command(`sudo install -m 755 "${source}" ${destination}`));
        info(`Remove legacy stam shell functions from ${rcFiles.join(' and ')} if present.`);
        return;
    }

    await run('sudo', ['mkdir', '-p', '/usr/local/bin'], { verbosity: RunVerbosity.Output });
    await run('sudo', ['install', '-m', '755', source, destination], { verbosity: RunVerbosity.Output });
    success(`Installed ${destination}`);

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
