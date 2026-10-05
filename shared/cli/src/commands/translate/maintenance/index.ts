import { Command } from '@oclif/core';
import { showHelp } from '../../../runtime/show-help.js';

export default class TranslateMaintenance extends Command {
    static summary = 'Specialist translation cache, key, and repair tools';
    static description = 'Use auto for release preparation or manual for individual stages. These specialist tools modify caches, keys, or machine translations; inspect each command\'s help before running it. Running maintenance without a subcommand only shows help.';
    static examples = ['stam translate maintenance filter-invalid --dry-run', 'stam translate maintenance clear-cache'];

    async run(): Promise<void> {
        await showHelp(this.config, ['translate', 'maintenance']);
    }
}
