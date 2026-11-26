import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import { devCaptureSelectors } from '@node/observability/dev-capture-selectors';
import { withSpan } from '@common/opentelemetry-decorators';
import { BaseCommand } from '../../base-command.js';
import { openFlag, servicesOptionFlag, stripeFlag } from '../../command-flags.js';
import { getProjectPath } from '../../context/project-path.js';
import { showHelp } from '../../runtime/show-help.js';
import { traceDetails } from '../../runtime/dev-trace-view.js';
import { checkNodeVersion, printNodeVersionStatus } from '../../workflows/setup-node.js';
import { DevTarget, runDev } from '../../workflows/start-dev.js';

const devTargets = Object.values(DevTarget);

export default class Dev extends BaseCommand {
    static summary = 'Run local development targets';
    static description =
        'Start the full stack, backend, frontend, or a single instance. Local traces show a compact waterfall by default. --quiet selects only traces with warnings, failures or known omissions.';
    static examples = [
        'stam dev all --env keeo --open',
        'stam dev backend --env keeo --name feature-payments --stripe',
        'stam dev backend --trace-filter "PATCH /invoices" --trace-detail full',
        'stam dev frontend --name feature-payments --services',
        'stam dev docs',
    ];

    static args = {
        target: Args.string({
            description: 'Development target to start',
            options: [...devTargets],
            required: false,
        }),
    };

    static flags = {
        ...BaseCommand.instanceFlags,
        services: servicesOptionFlag,
        stripe: stripeFlag,
        open: openFlag,
        'trace-filter': Flags.string({
            description: `Capture every matching local request or job (also STAM_DEV_CAPTURE). Choices: ${devCaptureSelectors.join(', ')}`,
        }),
        'trace-detail': Flags.option({
            options: traceDetails,
            default: 'compact',
            description:
                'Trace presentation only: one-line summary, compact timing and problem branches, or full waterfall',
        })(),
    };

    async run(): Promise<void> {
        const parsed = await this.parse(Dev);
        const { args, flags } = parsed;
        if (!args.target) {
            await showHelp(this.config, ['dev']);
            return;
        }

        const target = parseDevTarget(args.target);
        const trace = flags['trace-filter'] ?? process.env.STAM_DEV_CAPTURE;
        if (trace !== undefined) {
            if (!devCaptureSelectors.includes(trace)) {
                this.error(
                    `Unsupported trace selector. Choices: ${devCaptureSelectors.join(', ')}.`,
                );
            }
            if (target === DevTarget.Frontend || target === DevTarget.Docs) {
                this.error('--trace-filter requires the all, instance, or backend target.');
            }
        }
        const rootDir = path.resolve(getProjectPath());
        const nodeCheck = await checkNodeVersion(rootDir);
        if (!nodeCheck.ok) {
            printNodeVersionStatus(nodeCheck);
            return;
        }

        const { context } = await withSpan(
            'dev.workspace',
            () => this.parseWithContext(Dev, parsed),
            { label: 'Resolving development workspace' },
        );
        await runDev(context, target, {
            services: flags.services ?? target !== DevTarget.Frontend,
            stripe: flags.stripe,
            open: flags.open,
            traceFilter: trace,
            traceDetail: flags['trace-detail'],
        });
    }
}

function parseDevTarget(target: string): DevTarget {
    if (isDevTarget(target)) {
        return target;
    }

    throw new Error(`Unsupported dev target: ${target}`);
}

function isDevTarget(target: string): target is DevTarget {
    return devTargets.includes(target as DevTarget);
}
