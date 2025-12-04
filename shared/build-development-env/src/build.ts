import { buildPresets, InitFunction } from './buildPresets.js';
import { getProjectPath } from './helpers/project-path.js';
import { Service } from './Service.js';
import fs from 'node:fs/promises';

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    }
    catch {
        return false;
    }
}

export async function loadEnvironmentFile(name: string) {
    const rootPath = await getProjectPath();

    const envFileName = name ? `env.${name}` : 'env';

    if (!(await fileExists(rootPath + envFileName + '.js'))) {
        throw new Error(`Environment file "${envFileName}.js" not found in the root directory`);
    }

    const isInternalContributor = await fileExists(rootPath + '.internal-contributor');

    // Load names
    const globalEnvFile = await import(rootPath + envFileName + '.js');
    let localEnvFile: any = undefined;

    try {
        localEnvFile = await import(rootPath + envFileName + '.local.js');
    }
    catch (e) {
        // If the local env file doesn't exist, we can ignore it
    }

    let environment = localEnvFile ?? globalEnvFile;

    if (isInternalContributor) {
        environment = {
            ...environment,
            presets: [...(environment.presets ?? []), 'internal'],
        };
    }

    return environment;
}

export async function buildConfig(name: string, service: Service): Promise<{ config: any; initFunctions: InitFunction[] }> {
    const projectPath = await getProjectPath();
    const environment = await loadEnvironmentFile(name);

    // Only return these env variables in backend services, to not expose development credentials in the browser
    const backendSpecific: Partial<BackendSpecificEnvironment> = {
        // By default use local MySQL server
        DB_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_PASS: 'root',
        DB_DATABASE: 'stamhoofd',

        // We don't need AWS in development, so set it to empty values
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
        AWS_REGION: 'eu-west-1',

        // We do need an AWS S3 compatible storage in development.
        // Set it to empty for now...
        SPACES_ENDPOINT: 'ams3.digitaloceanspaces.com',
        SPACES_BUCKET: 'stamhoofd',
        SPACES_KEY: '',
        SPACES_SECRET: '',
        SPACES_PREFIX: 'simon', // todo: use username

        // Mollie client id is shared with the frontend
        MOLLIE_SECRET: '',
        MOLLIE_API_KEY: '',

        // Stripe secret key - required to test Stripe locally
        STRIPE_SECRET_KEY: '',
        STRIPE_ENDPOINT_SECRET: '',
        STRIPE_CONNECT_ENDPOINT_SECRET: '',

        // An internal secret, used for verifying infomration passed between services
        // This one is public and committed to the repository because it is only used in development
        INTERNAL_SECRET_KEY: 'vklRsSAOd0hqb4sx42kcTpFK6f3rCePi3HK/pJw5vz8=',

        // Disable crons in certain development environments
        CRONS_DISABLED: false,

        // Change this if the SMTP server can't send from all domains
        WHITELISTED_EMAIL_DESTINATIONS: ['*'],

        // Whether to store cache files: todo
        CACHE_PATH: 'backend' in service ? (projectPath + 'backend/app/' + service.backend + '/.cache') : undefined,

        // These are used in development, and are not used in production so safe to use.
        FILE_SIGNING_PUBLIC_KEY: { kty: 'EC', x: 'LZPou8JKNPoxgc1FXqLW_dqAYrv3_3ZoFHACwCiiunw', y: 'kBSKvtDVpa29J2mh5pICQD12dKO25fU3Bz-JItNAgEE', crv: 'P-256' },
        FILE_SIGNING_PRIVATE_KEY: { kty: 'EC', x: 'LZPou8JKNPoxgc1FXqLW_dqAYrv3_3ZoFHACwCiiunw', y: 'kBSKvtDVpa29J2mh5pICQD12dKO25fU3Bz-JItNAgEE', crv: 'P-256', d: 'C0xuuMOMKeIDP6YPOz2dO1ccMYYrnpDpzz-_oRoq4io' },
        FILE_SIGNING_ALG: 'ES256',

        // Doesn't matter in development, unless you want to test the upgrade toasts and flows
        LATEST_IOS_VERSION: 109,
        LATEST_ANDROID_VERSION: 109,

        // To test Mollie, we'll need the keys in both the frontend and backend
        MOLLIE_CLIENT_ID: '',
        MOLLIE_ORGANIZATION_TOKEN: '',
    };

    const frontendSpecific: FrontendSpecificEnvironment = {
        // To test Mollie, we'll need the keys in both the frontend and backend
        MOLLIE_CLIENT_ID: '',

        // The version is visible in the footer of the frontend
        VERSION: '',
    };

    const base: Partial<SharedEnvironment> = {
        environment: 'development',
    };

    const { config: presetConfig, initFunctions } = await buildPresets((environment.presets ?? []) as string[], service);

    if ('backend' in service) {
        return {
            config: {
                ...backendSpecific,
                ...base,
                ...presetConfig,
                ...environment,
            },
            initFunctions,
        };
    }

    return {
        config: {
            ...frontendSpecific,
            ...base,
            ...presetConfig,
            ...environment,
        },
        initFunctions,
    };
}

export async function build(name: string, service: Service): Promise<any> {
    return (await buildConfig(name, service)).config;
}
