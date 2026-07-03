import type { SharedEnvironment } from '@stamhoofd/types/Environment';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { read1PasswordCli } from '../runtime/one-password.js';
import type { AppService } from './development-config.js';

/**
 * Internal contributors mark their checkout with a `.internal-contributor` file at the
 * repo root. When present (and `op` is authenticated) we enrich the development
 * environment with the shared internal credentials stored in 1Password.
 *
 * External contributors never have the marker file, so this is a no-op for them and no
 * 1Password calls are made.
 */
export async function applyInternalSecrets(context: CliContext, service: AppService, env: SharedEnvironment): Promise<SharedEnvironment> {
    if (!await isInternalContributor(context.rootDir)) {
        return env;
    }

    const cacheDir = path.join(context.generatedDir, 'cache', '1password');
    const read = (key: string) => read1PasswordCli(key, { optional: true, cacheDir });

    // The Mollie client id is the only secret the frontend needs.
    if ('frontend' in service) {
        return withSecrets(env, {
            MOLLIE_CLIENT_ID: await read('op://Localhost/Mollie/MOLLIE_CLIENT_ID'),
        });
    }

    // Only the API backend talks to these external integrations.
    if (service.backend !== 'api') {
        return env;
    }

    // Read serially: 1Password prompts for Touch ID per process, so concurrent reads
    // would trigger multiple prompts. Serial reads keep it to a single authorization.
    // STRIPE_SECRET_KEY is intentionally left to the CLI's existing resolution
    // (stripe-service / the --stripe listener) and is never touched here.
    return withSecrets(env, {
        MOLLIE_CLIENT_ID: await read('op://Localhost/Mollie/MOLLIE_CLIENT_ID'),
        MOLLIE_API_KEY: await read('op://Localhost/Mollie/MOLLIE_API_KEY'),
        MOLLIE_SECRET: await read('op://Localhost/Mollie/MOLLIE_SECRET'),
        MOLLIE_ORGANIZATION_TOKEN: await read('op://Localhost/Mollie/MOLLIE_ORGANIZATION_TOKEN'),
        STRIPE_ACCOUNT_ID: await read('op://Localhost/Stripe/STRIPE_ACCOUNT_ID'),
        UITPAS_API_CLIENT_ID: await read('op://Localhost/UiTPAS/client_id'),
        UITPAS_API_CLIENT_SECRET: await read('op://Localhost/UiTPAS/client_secret'),
        UITPAS_API_URL: await read('op://Localhost/UiTPAS/api_url'),
        GATEWAYAPI_TOKEN: await read('op://DevOps Development/GatewayAPI/token'),
    });
}

async function isInternalContributor(rootDir: string): Promise<boolean> {
    try {
        await fs.access(path.join(rootDir, '.internal-contributor'));
        return true;
    } catch {
        return false;
    }
}

/**
 * Merge resolved secrets into the environment, skipping empty values so an optional
 * 1Password miss never blanks out an existing default.
 */
function withSecrets(env: SharedEnvironment, secrets: Record<string, string>): SharedEnvironment {
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
        if (value) {
            overrides[key] = value;
        }
    }
    return { ...env, ...overrides } as SharedEnvironment;
}
