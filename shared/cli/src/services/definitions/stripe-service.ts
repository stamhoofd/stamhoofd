import path from 'node:path';
import type { CliContext } from '../../context/create-context.js';
import { buildDomains } from '../../config/build-config.js';
import { read1PasswordCli } from '../../runtime/one-password.js';
import { DockerService } from '../docker-service.js';
import * as docker from '../docker.js';

const stripeImage = 'docker.io/stripe/stripe-cli:latest';

type StripePrepared = {
    apiKey: string;
    domain: string;
    forwardTo: string;
    secret: string;
};

export class StripeService extends DockerService<void, StripePrepared> {
    readonly key = 'stripe';
    readonly name = 'Stripe';
    override readonly logsEnabled = false;

    getContainer(context: CliContext): string {
        return StripeService.container(context);
    }

    getDetail(context: CliContext): string {
        const domains = buildDomains(context);
        return `http://${domains.api}/stripe/webhooks`;
    }

    async prepare(context: CliContext): Promise<StripePrepared> {
        await docker.requireDocker();
        const apiKey = await StripeService.resolveApiKey(context);
        if (!apiKey) {
            throw new Error('Missing Stripe API key. Set STRIPE_API_KEY or STRIPE_SECRET_KEY, or run with --no-stripe.');
        }
        const domains = buildDomains(context);
        const forwardTo = `http://${domains.api}/stripe/webhooks`;
        const secret = await StripeService.fetchWebhookSecret(context, apiKey);
        return { apiKey, domain: domains.api, forwardTo, secret };
    }

    canReuse(): boolean {
        return false;
    }

    getDockerArgs(context: CliContext, _options: void, prepared: StripePrepared): string[] {
        return ['run', '-d', '--name', StripeService.container(context), '--network', 'host', stripeImage, 'listen', '--api-key', prepared.apiKey, '--forward-to', prepared.forwardTo];
    }

    getEnv(_context: CliContext, _options: void, prepared: StripePrepared): NodeJS.ProcessEnv {
        return {
            STRIPE_SECRET_KEY: prepared.apiKey,
            STRIPE_ENDPOINT_SECRET: prepared.secret,
            STRIPE_CONNECT_ENDPOINT_SECRET: prepared.secret,
        };
    }

    override startedMessage(_context: CliContext, _options: void, prepared: StripePrepared): string {
        return `Stripe listener started for ${prepared.domain}`;
    }

    static async fetchWebhookSecret(context: CliContext, apiKey: string): Promise<string> {
        const result = await docker.run(['run', '--rm', '--network', 'host', stripeImage, 'listen', '--api-key', apiKey, '--print-secret'], { capture: true, verbose: context.verbose });
        const secret = result.stdout.trim().split('\n').at(-1)?.trim();
        if (!secret) {
            throw new Error('Stripe did not return a webhook signing secret.');
        }
        return secret;
    }

    static async resolveApiKey(context: CliContext): Promise<string> {
        if (process.env.STRIPE_API_KEY) {
            return process.env.STRIPE_API_KEY;
        }
        if (process.env.STRIPE_SECRET_KEY) {
            return process.env.STRIPE_SECRET_KEY;
        }
        return await read1PasswordCli('op://Localhost/Stripe/STRIPE_SECRET_KEY', {
            optional: true,
            cacheDir: path.join(context.generatedDir, 'cache', '1password'),
        });
    }

    static container(context: CliContext): string {
        return `${context.instance.name}-stripe`.replace(/[^\w.-]/g, '-');
    }
}

export const stripeService = new StripeService();
