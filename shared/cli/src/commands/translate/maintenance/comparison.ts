import { Command } from '@oclif/core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectPath } from '../../../context/project-path.js';
import { run, RunVerbosity } from '../../../runtime/command-runner.js';
import { globals } from 'i18n-uuid/globals';
import { createAutoTranslateComparison } from 'i18n-uuid/create-comparison';
import { info, warning } from '../../../runtime/ux.js';

export default class TranslateComparison extends Command {
    static summary = 'Generate legacy translation comparison JSON files';
    static description = 'Build locales and write comparison files under .development/i18n-uuid/output. This makes no AI requests and does not modify source translations. The legacy format repeats the same saved machine translation under every provider label; it does not compare independent provider results.';

    async run(): Promise<void> {
        await this.parse(TranslateComparison);
        warning('Legacy comparison labels repeat the same saved translation; they are not independent provider results.');
        await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
        await fs.mkdir(globals.COMPARE_OUTPUT_DIR, { recursive: true });
        createAutoTranslateComparison();
        info(`Comparison files written to ${path.resolve(globals.COMPARE_OUTPUT_DIR)}.`);
    }
}
