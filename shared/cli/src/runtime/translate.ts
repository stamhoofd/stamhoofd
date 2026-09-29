import path from 'node:path';
import { getProjectPath } from '../context/project-path.js';
import { run, RunVerbosity } from './command-runner.js';

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

export async function translateMachine(): Promise<void> {
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await inTranslationDirectory(async () => {
        const { autoTranslate } = await import('i18n-uuid/auto-translate');
        await autoTranslate({});
    });
}

export async function translate(): Promise<void> {
    await translateKeys();
    await translateCompress();
    await translateMachine();
}
