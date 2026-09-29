import { getProjectPath } from '../context/project-path.js';
import { run, RunVerbosity } from './command-runner.js';

async function runScript(directory: string, script: string): Promise<void> {
    await run('pnpm', ['--dir', directory, 'run', script], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
}

export async function translateKeys(): Promise<void> {
    await runScript('.development/i18n-uuid', 'replace-keys');
    await runScript('.development/i18n-uuid', 'replace-keys');
}

export async function translateCompress(): Promise<void> {
    await runScript('shared/locales', 'build');
    await runScript('.development/i18n-uuid', 'merge-duplicates');
    await runScript('.development/i18n-uuid', 'unused-keys');
}

export async function translateMachine(): Promise<void> {
    await runScript('shared/locales', 'build');
    await runScript('.development/i18n-uuid', 'auto-translate');
}

export async function translate(): Promise<void> {
    await translateKeys();
    await translateCompress();
    await translateMachine();
}
