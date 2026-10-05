import path from 'node:path';
import { getProjectPath } from '../context/project-path.js';
import { run, RunVerbosity } from './command-runner.js';
import type { autoTranslate } from 'i18n-uuid/auto-translate';

async function inTranslationDirectory(action: () => void | Promise<void>): Promise<void> {
    const previousDirectory = process.cwd();
    process.chdir(path.join(getProjectPath(), '.development/i18n-uuid'));
    try {
        await action();
    }
    finally {
        process.chdir(previousDirectory);
    }
}

export async function translateKeys(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { replaceKeys } = await import('i18n-uuid/replace-keys');
        replaceKeys();
        replaceKeys();
    });
}

export async function translateCompress(): Promise<void> {
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await inTranslationDirectory(async () => {
        const { mergeDuplicates } = await import('i18n-uuid/merge-duplicates');
        const { unusedKeys } = await import('i18n-uuid/unused-keys');
        mergeDuplicates();
        unusedKeys();
    });
}

export async function translateMachine(options: Parameters<typeof autoTranslate>[0] = {}): Promise<void> {
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await inTranslationDirectory(async () => {
        const { autoTranslate } = await import('i18n-uuid/auto-translate');
        await autoTranslate(options);
    });
}

export async function translate(options: { machine?: Parameters<typeof autoTranslate>[0]; skipMachine?: boolean } = {}): Promise<void> {
    await translateKeys();
    await translateCompress();
    if (!options.skipMachine) {
        await translateMachine(options.machine);
    }
}
