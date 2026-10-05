import { Command } from '@oclif/core';
import { showHelp } from '../../../runtime/show-help.js';

export default class TranslateManual extends Command {
    static summary = 'Run translation steps individually';
    static description = 'Run keys, cleanup, and machine separately when you need control over individual stages. Source migration and unchanged-translation review are optional tools, not stages of auto.';
    static examples = ['stam translate manual keys', 'stam translate manual cleanup', 'stam translate manual machine --locale fr'];

    async run(): Promise<void> {
        await showHelp(this.config, ['translate', 'manual']);
    }
}
