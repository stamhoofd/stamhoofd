import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { coverageTestPackages, runUnitTests, unitTestPackages } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';
import { showHelp } from '../../runtime/show-help.js';

export default class Test extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run unit tests';
    static description = [
        'The first argument selects what to run: `unit` for every package, `coverage` for package coverage, or a single package name',
        `(${unitTestPackages.map(pkg => pkg.name).join(', ')}).`,
        'Any extra arguments are vitest filename filters, and `-t` filters by test name.',
        '`build:shared` runs automatically first (skip with `--skip-build`), and MySQL only starts',
        'when a selected package needs it. Use `stam test e2e` / `stam test all` for Playwright.',
    ].join(' ');

    static examples = [
        'stam test unit',
        'stam test coverage',
        'stam test api',
        'stam test unit SomeFile.test.ts',
        'stam test structures bundle-discounts',
        'stam test structures bundle-discounts -t "Only these tests"',
        'stam test structures -t "Only these tests"',
        'stam test api --skip-build',
        'stam test api --shard 1/2 --json-report /reports/api-1.json',
        'stam test components ImageComponent',
    ];

    // strict = false so unknown first arguments (package names, filename filters) fall through to
    // this command instead of being treated as a missing `test:<name>` subcommand.
    static strict = false;

    static args = {
        target: Args.string({ description: '`unit` to run everything, or a package name', required: false }),
        filter: Args.string({ description: 'Filename filter(s) passed to vitest', required: false }),
    };

    static flags = {
        ...this.verbosityFlags(),
        'ci': ciFlag,
        'clear': Flags.boolean({ default: false, description: 'Reset the persistent test database (drop its volume) before running' }),
        'coverage': Flags.boolean({ default: false, description: 'Collect coverage for the selected package' }),
        'test-name': Flags.string({ char: 't', description: 'Only run tests whose name matches this text (vitest -t)' }),
        'skip-build': Flags.boolean({ default: false, description: 'Skip the automatic build:shared step' }),
        'shard': Flags.string({ description: 'Run one shard of the suite on a separate machine (1-based index/total, e.g. 1/2)' }),
        'json-report': Flags.string({ description: 'Write a Vitest JSON report with per-file timings (single package only)' }),
    };

    async run(): Promise<void> {
        const parsed = await this.parse(Test);
        const { argv, flags } = parsed;
        const positionals = argv as string[];

        if (positionals.length === 0) {
            await showHelp(this.config, ['test']);
            return;
        }

        const [target, ...fileFilters] = positionals;
        if (flags.shard !== undefined) {
            const [index, total] = flags.shard.split('/').map(Number);
            if (!/^[1-9]\d*\/[1-9]\d*$/.test(flags.shard) || !Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index > total) {
                throw new Error('--shard must be index/total with 1 <= index <= total (e.g. 1/2)');
            }
        }

        let packages = target === 'coverage' ? coverageTestPackages : unitTestPackages;
        if (target !== 'unit' && target !== 'coverage') {
            const pkg = unitTestPackages.find(candidate => candidate.name === target);
            if (!pkg) {
                throw new Error(`Unknown test target '${target}'. Use 'unit' or one of: ${unitTestPackages.map(candidate => candidate.name).join(', ')}.`);
            }
            packages = [pkg];
        }

        const { context } = await this.parseWithContext(Test, parsed);
        await runUnitTests(context, {
            packages,
            fileFilters,
            testNamePattern: flags['test-name'],
            ci: flags.ci,
            skipBuild: flags['skip-build'],
            clear: flags.clear,
            coverage: target === 'coverage' || flags.coverage,
            shard: flags.shard,
            jsonReport: flags['json-report'],
        });
    }
}
