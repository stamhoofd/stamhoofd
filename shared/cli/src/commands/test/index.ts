import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { runUnitTests, unitTestPackages } from '../../runtime/monorepo-runner.js';
import { showHelp } from '../../runtime/show-help.js';

export default class Test extends BaseCommand {
    static summary = 'Run unit tests';
    static description = [
        'The first argument selects what to run: `unit` for every package, or a single package name',
        `(${unitTestPackages.map(pkg => pkg.name).join(', ')}).`,
        'Any extra arguments are vitest filename filters, and `-t` filters by test name.',
        '`build:shared` runs automatically first (skip with `--skip-build`), and MySQL only starts',
        'when a selected package needs it. Use `stam test e2e` / `stam test all` for Playwright.',
    ].join(' ');

    static examples = [
        'stam test unit',
        'stam test api',
        'stam test unit SomeFile.test.ts',
        'stam test structures bundle-discounts',
        'stam test structures bundle-discounts -t "Only these tests"',
        'stam test structures -t "Only these tests"',
        'stam test api --skip-build',
    ];

    // strict = false so unknown first arguments (package names, filename filters) fall through to
    // this command instead of being treated as a missing `test:<name>` subcommand.
    static strict = false;

    static args = {
        target: Args.string({ description: '`unit` to run everything, or a package name', required: false }),
        filter: Args.string({ description: 'Filename filter(s) passed to vitest', required: false }),
    };

    static flags = {
        ...BaseCommand.verboseFlags,
        'ci': ciFlag,
        'clear': Flags.boolean({ default: false, description: 'Reset the persistent test database (drop its volume) before running' }),
        'test-name': Flags.string({ char: 't', description: 'Only run tests whose name matches this text (vitest -t)' }),
        'skip-build': Flags.boolean({ default: false, description: 'Skip the automatic build:shared step' }),
    };

    async run(): Promise<void> {
        const { argv, flags } = await this.parse(Test);
        const positionals = argv as string[];

        if (positionals.length === 0) {
            await showHelp(this.config, ['test']);
            return;
        }

        const [target, ...fileFilters] = positionals;

        let packages = unitTestPackages;
        if (target !== 'unit') {
            const pkg = unitTestPackages.find(candidate => candidate.name === target);
            if (!pkg) {
                throw new Error(`Unknown test target '${target}'. Use 'unit' or one of: ${unitTestPackages.map(candidate => candidate.name).join(', ')}.`);
            }
            packages = [pkg];
        }

        await runUnitTests(await this.createContext(flags), {
            packages,
            fileFilters,
            testNamePattern: flags['test-name'],
            ci: flags.ci,
            skipBuild: flags['skip-build'],
            clear: flags.clear,
        });
    }
}
