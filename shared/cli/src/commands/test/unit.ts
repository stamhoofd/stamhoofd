import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { testUnit } from '../../runtime/monorepo-runner.js';

export default class TestUnit extends BaseCommand {
    static summary = 'Run unit tests';
    static description = 'Use this for the fastest feedback loop when you are iterating on backend logic, shared utilities, or small code changes.';
    static examples = [
        'stam test unit',
        'stam test unit --ci --verbose',
    ];
    static flags = { ...BaseCommand.verboseFlags, ci: ciFlag };

    async run(): Promise<void> {
        const { flags } = await this.parse(TestUnit);
        await testUnit(await this.createContext(flags), flags.ci);
    }
}
