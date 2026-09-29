import { Command } from '@oclif/core';
import { translate } from '../../runtime/translate.js';

export default class Translate extends Command {
    static summary = 'Replace translation keys, clean up translations, and machine-translate';
    static description = 'Run the translation pipeline in order: keys, compress, then machine. Each step can also be run separately.';
    static examples = [
        'stam translate',
        'stam translate keys',
        'stam translate compress',
        'stam translate machine',
    ];

    async run(): Promise<void> {
        await this.parse(Translate);
        await translate();
    }
}
