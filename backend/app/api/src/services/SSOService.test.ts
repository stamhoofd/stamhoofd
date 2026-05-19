import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-endpoints';
import { Platform } from '@stamhoofd/models';
import { LoginMethod, LoginMethodConfig, LoginProviderType, OpenIDClientConfiguration } from '@stamhoofd/structures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContextInstance } from '../helpers/Context.js';
import { SSOService } from './SSOService.js';

describe('SSOService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fromContext', () => {
        it('does not validate by default', async () => {
            mockPlatform({
                ssoConfiguration: OpenIDClientConfiguration.create({}),
                loginMethods: new Map(),
            });

            const service = await runWithContext(() => SSOService.fromContext(LoginProviderType.SSO));

            expect(service).toBeInstanceOf(SSOService);
        });

        it('validates when requested explicitly', async () => {
            mockPlatform({
                ssoConfiguration: OpenIDClientConfiguration.create({}),
                loginMethods: new Map(),
            });

            await expect(runWithContext(() => SSOService.fromContext(LoginProviderType.SSO, { validate: true }))).rejects.toThrow('SSO not configured (correctly)');
        });
    });

    describe('validateConfiguration', () => {
        it('validates the OpenID client configuration getter', () => {
            const service = createService({
                googleConfiguration: null,
                loginMethods: new Map([[LoginMethod.Google, LoginMethodConfig.create({})]]),
                provider: LoginProviderType.Google,
                organization: {},
            });

            expect(() => service.validateConfiguration()).toThrow(SimpleError);
            expect(() => service.validateConfiguration()).toThrow('SSO not configured');
        });

        it('validates the login method configuration getter', () => {
            const service = createService({
                ssoConfiguration: OpenIDClientConfiguration.create({}),
                loginMethods: new Map(),
                provider: LoginProviderType.SSO,
            });

            expect(() => service.validateConfiguration()).toThrow(SimpleError);
            expect(() => service.validateConfiguration()).toThrow('SSO not configured (correctly)');
        });

        it('accepts complete SSO configuration', () => {
            const service = createService({
                ssoConfiguration: OpenIDClientConfiguration.create({}),
                loginMethods: new Map([[LoginMethod.SSO, LoginMethodConfig.create({})]]),
                provider: LoginProviderType.SSO,
            });

            expect(() => service.validateConfiguration()).not.toThrow();
        });
    });
});

async function runWithContext<T>(handler: () => Promise<T>) {
    const context = new ContextInstance(new Request({
        method: 'GET',
        url: '/',
        host: '',
    }));

    return await ContextInstance.asyncLocalStorage.run(context, handler);
}

function mockPlatform(options: {
    loginMethods: Map<LoginMethod, LoginMethodConfig>;
    ssoConfiguration?: OpenIDClientConfiguration | null;
    googleConfiguration?: OpenIDClientConfiguration | null;
}) {
    vi.spyOn(Platform, 'getForEditing').mockResolvedValue(createPlatform(options));
}

function createService(options: {
    provider: LoginProviderType;
    loginMethods: Map<LoginMethod, LoginMethodConfig>;
    ssoConfiguration?: OpenIDClientConfiguration | null;
    googleConfiguration?: OpenIDClientConfiguration | null;
    organization?: any;
}) {
    return new SSOService({
        provider: options.provider,
        platform: createPlatform(options),
        organization: options.organization,
    });
}

function createPlatform(options: {
    loginMethods: Map<LoginMethod, LoginMethodConfig>;
    ssoConfiguration?: OpenIDClientConfiguration | null;
    googleConfiguration?: OpenIDClientConfiguration | null;
}) {
    return {
        config: {
            loginMethods: options.loginMethods,
        },
        serverConfig: {
            ssoConfiguration: options.ssoConfiguration,
            googleConfiguration: options.googleConfiguration,
        },
    } as any;
}
