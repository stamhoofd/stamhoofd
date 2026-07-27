import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { defaultLocalMysqlPort, e2eMysqlPortVariable } from '../../config/test-database-config.js';
import { testE2e } from '../../runtime/monorepo-runner.js';

export default class TestE2e extends BaseCommand {
    static summary = 'Run Playwright browser tests';
    static description = 'Use this when you changed user-facing flows and want to validate the app in a real browser environment.';
    static examples = [
        'stam test e2e',
        'stam test e2e --grep @billing',
        'stam test e2e --grep @billing --skip-build',
        'stam test e2e --clear',
        'stam test e2e --ci',
        'stam test e2e --extra',
        'stam test e2e --workers 2',
        'stam test e2e --local-db',
        'stam test e2e --ui --verbose',
    ];

    static flags = {
        ...BaseCommand.verboseFlags,
        'ci': ciFlag,
        'clear': Flags.boolean({ default: false, description: 'Clear the persistent e2e database before running tests' }),
        'extra': Flags.boolean({ default: false, description: 'Include Playwright tests tagged @extra' }),
        'grep': Flags.string({ char: 'g', description: 'Only run tests matching this pattern/tag (passed to playwright --grep)' }),
        'local-db': Flags.boolean({ allowNo: true, description: `Connect to the MySQL already running on 127.0.0.1 instead of starting an e2e MySQL container (port ${e2eMysqlPortVariable}, default ${defaultLocalMysqlPort})` }),
        'skip-build': Flags.boolean({ default: false, description: 'Skip build:shared, the API test pre-build, and the frontend build (only test files changed)' }),
        'ui': Flags.boolean({ default: false, description: 'Run Playwright in UI mode' }),
        'workers': Flags.integer({ description: 'Number of Playwright workers' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(TestE2e);
        if (flags.workers !== undefined && flags.workers < 1) {
            throw new Error('--workers must be at least 1');
        }
        await testE2e(await this.createContext(flags), { ci: flags.ci, clear: flags.clear, extra: flags.extra, grep: flags.grep, localDb: flags['local-db'], skipBuild: flags['skip-build'], ui: flags.ui, workers: flags.workers });
    }
}
