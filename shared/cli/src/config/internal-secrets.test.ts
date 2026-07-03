import type { BackendEnvironment, FrontendEnvironment, SharedEnvironment } from '@stamhoofd/types/Environment';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { read1PasswordCli } from '../runtime/one-password.js';
import { applyInternalSecrets } from './internal-secrets.js';

vi.mock('../runtime/one-password.js', () => ({
    read1PasswordCli: vi.fn(),
}));

const read1PasswordCliMock = vi.mocked(read1PasswordCli);

let rootDir: string;

beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-internal-secrets-'));
    read1PasswordCliMock.mockReset();
    read1PasswordCliMock.mockResolvedValue('');
});

afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
});

function context(): CliContext {
    return {
        rootDir,
        generatedDir: path.join(rootDir, '.development/cli/generated'),
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}

async function markInternalContributor(): Promise<void> {
    await fs.writeFile(path.join(rootDir, '.internal-contributor'), '');
}

function mockSecrets(values: Record<string, string>): void {
    read1PasswordCliMock.mockImplementation((key: string) => Promise.resolve(values[key] ?? ''));
}

describe('applyInternalSecrets', () => {
    it('returns the environment unchanged when there is no .internal-contributor marker', async () => {
        const env = { MOLLIE_API_KEY: '' } as SharedEnvironment;

        const result = await applyInternalSecrets(context(), { backend: 'api' }, env);

        expect(result).toBe(env);
        expect(read1PasswordCliMock).not.toHaveBeenCalled();
    });

    it('injects Mollie, Stripe account id and UiTPAS secrets for the api backend', async () => {
        await markInternalContributor();
        mockSecrets({
            'op://Localhost/Mollie/MOLLIE_CLIENT_ID': 'mollie-client',
            'op://Localhost/Mollie/MOLLIE_API_KEY': 'mollie-api',
            'op://Localhost/Mollie/MOLLIE_ORGANIZATION_TOKEN': 'mollie-org',
            'op://Localhost/Stripe/STRIPE_ACCOUNT_ID': 'acct_123',
            'op://Localhost/UiTPAS/client_id': 'uitpas-client',
            'op://Localhost/UiTPAS/client_secret': 'uitpas-secret',
            'op://Localhost/UiTPAS/api_url': 'https://uitpas.example',
            'op://DevOps Development/GatewayAPI/token': 'gatewayapi-token',
        });
        // MOLLIE_SECRET is intentionally not mocked, so it resolves to '' and must be preserved.
        const env = { MOLLIE_SECRET: 'keep-me', STRIPE_SECRET_KEY: 'sk_live_existing' } as BackendEnvironment;

        const result = await applyInternalSecrets(context(), { backend: 'api' }, env) as BackendEnvironment;

        expect(result.MOLLIE_CLIENT_ID).toBe('mollie-client');
        expect(result.MOLLIE_API_KEY).toBe('mollie-api');
        expect(result.MOLLIE_ORGANIZATION_TOKEN).toBe('mollie-org');
        expect(result.STRIPE_ACCOUNT_ID).toBe('acct_123');
        expect(result.UITPAS_API_CLIENT_ID).toBe('uitpas-client');
        expect(result.UITPAS_API_CLIENT_SECRET).toBe('uitpas-secret');
        expect(result.UITPAS_API_URL).toBe('https://uitpas.example');
        expect(result.GATEWAYAPI_TOKEN).toBe('gatewayapi-token');

        // Empty 1Password reads must not blank out existing defaults.
        expect(result.MOLLIE_SECRET).toBe('keep-me');

        // STRIPE_SECRET_KEY resolution is left to the CLI and never touched here.
        expect(result.STRIPE_SECRET_KEY).toBe('sk_live_existing');
        expect(read1PasswordCliMock).not.toHaveBeenCalledWith('op://Localhost/Stripe/STRIPE_SECRET_KEY', expect.anything());
    });

    it('injects only the Mollie client id for frontend services', async () => {
        await markInternalContributor();
        mockSecrets({ 'op://Localhost/Mollie/MOLLIE_CLIENT_ID': 'mollie-client' });
        const env = { MOLLIE_CLIENT_ID: '' } as FrontendEnvironment;

        const result = await applyInternalSecrets(context(), { frontend: 'web-app' }, env) as FrontendEnvironment;

        expect(result.MOLLIE_CLIENT_ID).toBe('mollie-client');
        expect(read1PasswordCliMock).toHaveBeenCalledTimes(1);
        expect(read1PasswordCliMock).toHaveBeenCalledWith('op://Localhost/Mollie/MOLLIE_CLIENT_ID', expect.anything());
    });

    it('does not inject external secrets for non-api backends', async () => {
        await markInternalContributor();
        const env = { MOLLIE_API_KEY: '' } as BackendEnvironment;

        const result = await applyInternalSecrets(context(), { backend: 'renderer' }, env);

        expect(result).toBe(env);
        expect(read1PasswordCliMock).not.toHaveBeenCalled();
    });
});
