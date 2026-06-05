import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { openFlag, servicesOptionFlag, stripeFlag } from '../../command-flags.js';
import { showHelp } from '../../runtime/show-help.js';
import { DevTarget, runDev } from '../../workflows/start-dev.js';

const devTargets = Object.values(DevTarget);

export default class Dev extends BaseCommand {
    static summary = 'Run local development targets';
    static description = 'Use this to start the full stack, only the backend, only the frontend, or a single inferred local instance.';
    static examples = [
        'stam dev all --env keeo --open',
        'stam dev backend --env keeo --name feature-payments --stripe',
        'stam dev frontend --name feature-payments --services',
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
    };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(Dev);
        if (!args.target) {
            await showHelp(this.config, ['dev']);
            return;
        }

        const target = parseDevTarget(args.target);

        await runDev(await this.createContext(flags), target, {
            services: flags.services ?? defaultServicesForTarget(target),
            stripe: flags.stripe,
            open: flags.open,
        });
    }
}

function defaultServicesForTarget(target: DevTarget): boolean {
    return target !== DevTarget.Frontend;
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
