import type { BackendEnvironment, FrontendEnvironment, SharedEnvironment } from '@stamhoofd/types/Environment';
import type { StamhoofdDomains } from '@stamhoofd/types/StamhoofdDomains';
import { MemberNumberAlgorithm } from '@stamhoofd/types/MemberNumberAlgorithm';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { createContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { applyInternalSecrets } from './internal-secrets.js';
import { defaultDomain, localFilesAccessKey, localFilesSecretKey, localIpv4Host, localPrimaryBucket, maildevPassword, maildevUsername, mysqlInternalPort } from './shared-service-config.js';

export type AppService
    = | BackendAppService
        | FrontendAppService;

export enum BackendApp {
    Api = 'api',
    Renderer = 'renderer',
    Redirecter = 'redirecter',
    Backup = 'backup',
}

export enum FrontendApp {
    Webshop = 'webshop',
    Calculator = 'calculator',
    Mobile = 'mobile',
    WebApp = 'web-app',
}

export type BackendAppName = `${BackendApp}`;
export type FrontendAppName = `${FrontendApp}`;

export type BackendAppService = { backend: BackendAppName };
export type FrontendAppService = { frontend: FrontendAppName };

export type DevelopmentDomains = ReturnType<typeof buildDevelopmentDomains>;

export type DevelopmentConfig = {
    domains: DevelopmentDomains;
    ports: ReturnType<typeof buildPorts>;
    backendEnv: NodeJS.ProcessEnv;
    appEnv: SharedEnvironment;
};

type EnvironmentPreset = {
    userMode: SharedEnvironment['userMode'];
    translationNamespace: string;
    platformName: string;
    fixedCountry?: SharedEnvironment['fixedCountry'];
    locales?: SharedEnvironment['locales'];
    singleOrganization?: string;
    stripeConnectMethod?: BackendEnvironment['STRIPE_CONNECT_METHOD'];
    memberNumberAlgorithm?: BackendEnvironment['MEMBER_NUMBER_ALGORITHM'];
    memberNumberAlgorithmLength?: number;
    documentation?: string;
};

const fileSigningPublicKey = { kty: 'EC', x: 'LZPou8JKNPoxgc1FXqLW_dqAYrv3_3ZoFHACwCiiunw', y: 'kBSKvtDVpa29J2mh5pICQD12dKO25fU3Bz-JItNAgEE', crv: 'P-256' };
const fileSigningPrivateKey = { ...fileSigningPublicKey, d: 'C0xuuMOMKeIDP6YPOz2dO1ccMYYrnpDpzz-_oRoq4io' };

export function buildDevelopmentConfig(context: CliContext, service: AppService = { backend: BackendApp.Api }): DevelopmentConfig {
    const domains = buildDevelopmentDomains(context);
    const ports = buildPorts(context);
    const database = baseDatabase(context.env);
    const instanceDatabase = context.instance.primary ? database : `${database}-${context.instance.name}`;
    const bucket = context.instance.name === 'stamhoofd' ? localPrimaryBucket : `${localPrimaryBucket}-${context.instance.name}`;
    const backendEnv = {
        STAMHOOFD_ENV: context.env,
        STAMHOOFD_DEV_NAME: context.instance.name,
        STAMHOOFD_INSTANCE_PREFIX: context.instance.prefix,
        STAMHOOFD_PORT_OFFSET: String(context.instance.portOffset),
        STAMHOOFD_PORT_OFFSET_LOCKED: '1',
        DB_HOST: localIpv4Host,
        DB_USER: 'root',
        DB_PASS: 'root',
        DB_DATABASE: instanceDatabase,
        DB_PORT: String(ports.mysql),
        SPACES_ENDPOINT: domains.files,
        SPACES_BUCKET: bucket,
        SPACES_KEY: localFilesAccessKey,
        SPACES_SECRET: localFilesSecretKey,
        SPACES_FORCE_PATH_STYLE: 'true',
        SPACES_PUBLIC_URL: `https://${domains.files}/${bucket}`,
    };

    return {
        domains,
        ports,
        backendEnv,
        appEnv: buildAppEnvironment(context, domains, ports, backendEnv, service),
    };
}

export async function buildDevelopmentEnvironment(env: string, service: BackendAppService): Promise<BackendEnvironment>;
export async function buildDevelopmentEnvironment(env: string, service: FrontendAppService): Promise<FrontendEnvironment>;
export async function buildDevelopmentEnvironment(env: string, service: AppService): Promise<SharedEnvironment> {
    const context = await createContext({ env, verbose: false });
    const appEnv = buildDevelopmentConfig(context, service).appEnv;
    return await applyInternalSecrets(context, service, appEnv);
}

function buildDevelopmentDomains(context: CliContext) {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const prefix = context.instance.prefix;
    const labels = [context.env === 'stamhoofd' ? '' : context.env, prefix, domain].filter(label => label.length > 0);
    const appDomain = (service: string) => `${service}.${labels.join('.')}`;

    return {
        dashboard: appDomain('dashboard'),
        api: appDomain('api'),
        renderer: appDomain('renderer'),
        registration: appDomain('registration'),
        webshop: appDomain('shop'),
        mail: `mail.${domain}`,
        files: `files.${domain}`,
        filesConsole: `files-console.${domain}`,
        sso: appDomain('sso'),
        mysql: `mysql.${domain}`,
    };
}

function buildAppEnvironment(context: CliContext, domains: DevelopmentDomains, ports: ReturnType<typeof buildPorts>, backendEnv: NodeJS.ProcessEnv, service: AppService): SharedEnvironment {
    const preset = environmentPreset(context.env);
    const stamhoofdDomains = buildStamhoofdDomains(domains, preset);
    const shared = {
        environment: 'development',
        domains: stamhoofdDomains,
        userMode: preset.userMode,
        translationNamespace: preset.translationNamespace,
        platformName: preset.platformName,
        fixedCountry: preset.fixedCountry,
        locales: preset.locales,
        singleOrganization: preset.singleOrganization,
    } satisfies Partial<SharedEnvironment>;

    if ('frontend' in service) {
        return {
            ...shared,
            PORT: frontendPort(service.frontend, ports),
            VERSION: '',
            MOLLIE_CLIENT_ID: '',
        } as FrontendEnvironment;
    }

    return {
        ...shared,
        PORT: backendPort(service.backend, ports),
        DB_HOST: backendEnv.DB_HOST!,
        DB_USER: backendEnv.DB_USER!,
        DB_PASS: backendEnv.DB_PASS!,
        DB_DATABASE: backendEnv.DB_DATABASE!,
        DB_PORT: Number.parseInt(backendEnv.DB_PORT ?? String(mysqlInternalPort), 10),
        SMTP_HOST: localIpv4Host,
        SMTP_USERNAME: maildevUsername,
        SMTP_PASSWORD: maildevPassword,
        SMTP_PORT: ports.maildevSmtp,
        TRANSACTIONAL_SMTP_HOST: localIpv4Host,
        TRANSACTIONAL_SMTP_USERNAME: maildevUsername,
        TRANSACTIONAL_SMTP_PASSWORD: maildevPassword,
        TRANSACTIONAL_SMTP_PORT: ports.maildevSmtp,
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
        AWS_REGION: 'eu-west-1',
        SPACES_ENDPOINT: backendEnv.SPACES_ENDPOINT!,
        SPACES_BUCKET: backendEnv.SPACES_BUCKET!,
        SPACES_KEY: backendEnv.SPACES_KEY!,
        SPACES_SECRET: backendEnv.SPACES_SECRET!,
        SPACES_PREFIX: '',
        SPACES_FORCE_PATH_STYLE: true,
        SPACES_PUBLIC_URL: backendEnv.SPACES_PUBLIC_URL!,
        MOLLIE_CLIENT_ID: '',
        MOLLIE_SECRET: '',
        MOLLIE_API_KEY: '',
        MOLLIE_ORGANIZATION_TOKEN: '',
        LATEST_IOS_VERSION: 109,
        LATEST_ANDROID_VERSION: 109,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
        STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET ?? '',
        STRIPE_CONNECT_ENDPOINT_SECRET: process.env.STRIPE_CONNECT_ENDPOINT_SECRET ?? '',
        STRIPE_CONNECT_METHOD: preset.stripeConnectMethod,
        INTERNAL_SECRET_KEY: 'vklRsSAOd0hqb4sx42kcTpFK6f3rCePi3HK/pJw5vz8=',
        FILE_SIGNING_PUBLIC_KEY: fileSigningPublicKey,
        FILE_SIGNING_PRIVATE_KEY: fileSigningPrivateKey,
        FILE_SIGNING_ALG: 'ES256',
        CRONS_DISABLED: false,
        WHITELISTED_EMAIL_DESTINATIONS: ['*'],
        CACHE_PATH: path.join(context.rootDir, 'backend/app', service.backend, '.cache'),
        MEMBER_NUMBER_ALGORITHM: preset.memberNumberAlgorithm,
        MEMBER_NUMBER_ALGORITHM_LENGTH: preset.memberNumberAlgorithmLength,
    } as BackendEnvironment;
}

function frontendPort(service: FrontendAppService['frontend'], ports: ReturnType<typeof buildPorts>): number | undefined {
    // Keep the public API string-compatible while using enum values internally for comparisons.
    const app = service as FrontendApp;

    if (app === FrontendApp.WebApp) {
        return ports.webApp;
    }
    if (app === FrontendApp.Webshop) {
        return ports.webshop;
    }
    return undefined;
}

function buildStamhoofdDomains(domains: DevelopmentDomains, preset: EnvironmentPreset): StamhoofdDomains {
    return {
        dashboard: domains.dashboard,
        registration: preset.userMode === 'organization' ? { '': domains.registration, 'BE': domains.registration, 'NL': domains.registration } : undefined,
        marketing: { '': domains.dashboard },
        webshop: { '': domains.webshop, 'BE': domains.webshop, 'NL': domains.webshop },
        api: domains.api,
        rendererApi: domains.renderer,
        webshopCname: domains.webshop,
        registrationCname: { '': domains.registration },
        defaultTransactionalEmail: { '': 'stamhoofd.be', 'NL': 'stamhoofd.nl' },
        defaultBroadcastEmail: { '': 'stamhoofd.email' },
        documentation: preset.documentation ? { '': preset.documentation } : undefined,
    };
}

function backendPort(service: BackendAppService['backend'], ports: ReturnType<typeof buildPorts>): number {
    // Keep the public API string-compatible while using enum values internally for comparisons.
    const app = service as BackendApp;

    if (app === BackendApp.Renderer) {
        return ports.renderer;
    }
    return ports.api;
}

function baseDatabase(env: string): string {
    if (env === 'stamhoofd') {
        return 'stamhoofd-development';
    }
    if (env === 'jambo') {
        return 'stamhoofd-jamboree';
    }
    return `stamhoofd-${env}`;
}

function environmentPreset(env: string): EnvironmentPreset {
    if (env === 'keeo') {
        return {
            userMode: 'platform' as const,
            translationNamespace: env,
            platformName: env,
            fixedCountry: 'BE' as SharedEnvironment['fixedCountry'],
            memberNumberAlgorithm: MemberNumberAlgorithm.Incremental,
            memberNumberAlgorithmLength: 10,
            documentation: 'docs.keeo.fos.be',
        };
    }
    if (env === 'ravot') {
        return {
            userMode: 'platform' as const,
            translationNamespace: 'digit',
            platformName: 'ravot',
            fixedCountry: 'BE' as SharedEnvironment['fixedCountry'],
            memberNumberAlgorithm: MemberNumberAlgorithm.KSA,
            documentation: 'docs.ravot.ksa.be',
        };
    }
    if (env === 'jambo') {
        return {
            userMode: 'platform' as const,
            translationNamespace: 'jamboree',
            platformName: 'jamboree',
            fixedCountry: 'BE' as SharedEnvironment['fixedCountry'],
            locales: { BE: ['nl', 'fr'] } as SharedEnvironment['locales'],
            singleOrganization: '1d444815-3213-4a16-9846-91a41f2de9a4',
            memberNumberAlgorithm: MemberNumberAlgorithm.Incremental,
            memberNumberAlgorithmLength: 10,
        };
    }
    return {
        userMode: 'organization' as const,
        translationNamespace: 'stamhoofd',
        platformName: 'stamhoofd',
        stripeConnectMethod: 'express' as const,
        documentation: 'www.stamhoofd.be/docs-v2',
    };
}
