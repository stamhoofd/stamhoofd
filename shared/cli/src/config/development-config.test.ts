import { describe, expect, it, vi } from 'vitest';
import { localFilesAccessKey, localFilesSecretKey, localIpv4Host, localPrimaryBucket, maildevPassword, maildevUsername } from './shared-service-config.js';
import type { CliContext } from '../context/create-context.js';
import { buildDevelopmentConfig, FrontendApp } from './development-config.js';

function context(partial: Partial<CliContext> = {}): CliContext {
    return {
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
        ...partial,
    };
}

describe('buildDevelopmentConfig', () => {
    it('builds the primary Stamhoofd config', () => {
        const config = buildDevelopmentConfig(context());

        expect(config.domains.dashboard).toBe('dashboard.stamhoofd');
        expect(config.domains.api).toBe('api.stamhoofd');
        expect(config.backendEnv.DB_DATABASE).toBe('stamhoofd-development');
        expect(config.backendEnv.DB_HOST).toBe(localIpv4Host);
        expect(config.backendEnv.SPACES_KEY).toBe(localFilesAccessKey);
        expect(config.backendEnv.SPACES_SECRET).toBe(localFilesSecretKey);
        expect(config.appEnv.userMode).toBe('organization');
        expect(config.appEnv.domains.api).toBe('api.stamhoofd');
        expect(config.appEnv.domains.sgvLoginUrl).toBe('https://login.sgv.stamhoofd');
        expect(config.appEnv.domains.sgvAdminUrl).toBe('https://admin.sgv.stamhoofd');
        expect(config.appEnv.SMTP_HOST).toBe(localIpv4Host);
        expect(config.appEnv.SMTP_USERNAME).toBe(maildevUsername);
        expect(config.appEnv.SMTP_PASSWORD).toBe(maildevPassword);
    });

    it('uses environment domains for primary non-Stamhoofd configs', () => {
        const config = buildDevelopmentConfig(context({
            env: 'keeo',
            instance: {
                name: 'stamhoofd-keeo',
                prefix: '',
                primary: true,
                portOffset: 100,
            },
        }));

        expect(config.domains.dashboard).toBe('dashboard.keeo.stamhoofd');
        expect(config.domains.api).toBe('api.keeo.stamhoofd');
    });

    it('uses workspace domains for secondary Stamhoofd configs', () => {
        const config = buildDevelopmentConfig(context({
            instance: {
                name: 'stamhoofd-feature',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }));

        expect(config.domains.dashboard).toBe('dashboard.feature.stamhoofd');
        expect(config.domains.api).toBe('api.feature.stamhoofd');
    });

    it('isolates secondary environment configs by prefix and name', () => {
        const config = buildDevelopmentConfig(context({
            env: 'keeo',
            instance: {
                name: 'stamhoofd-feature-keeo',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }));

        expect(config.domains.dashboard).toBe('dashboard.keeo.feature.stamhoofd');
        expect(config.domains.api).toBe('api.keeo.feature.stamhoofd');
        expect(config.backendEnv.DB_DATABASE).toBe('stamhoofd-keeo-stamhoofd-feature-keeo');
        expect(config.backendEnv.STAMHOOFD_PORT_OFFSET).toBe('1200');
        expect(config.backendEnv.STAMHOOFD_PORT_OFFSET_LOCKED).toBe('1');
        expect(config.appEnv.userMode).toBe('platform');
        expect(config.appEnv.translationNamespace).toBe('keeo');
        expect(config.appEnv.domains.sgvLoginUrl).toBe('https://login.sgv.keeo.stamhoofd');
        expect(config.appEnv.domains.sgvAdminUrl).toBe('https://admin.sgv.keeo.stamhoofd');
    });

    it('assigns the resolved frontend port to dashboard apps', () => {
        const config = buildDevelopmentConfig(context({
            env: 'keeo',
            instance: {
                name: 'stamhoofd-feature-keeo',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }), { frontend: FrontendApp.Dashboard });

        expect(config.appEnv.PORT).toBe(9280);
    });

    it('uses custom shared domains for infrastructure', () => {
        vi.stubEnv('STAMHOOFD_DOMAIN', 'example');
        const config = buildDevelopmentConfig(context());

        expect(config.domains.files).toBe('files.example');
        expect(config.backendEnv.SPACES_PUBLIC_URL).toBe(`https://files.example/${localPrimaryBucket}`);
        vi.unstubAllEnvs();
    });
});
