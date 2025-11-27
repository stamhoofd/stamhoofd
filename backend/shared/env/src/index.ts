import chalk from 'chalk';
import crypto from 'crypto';
import fs, { promises } from 'fs';

async function fileExists(path: string): Promise<boolean> {
    try {
        await promises.access(path);
        return true;
    }
    catch {
        return false;
    }
}

async function load(settings?: { path?: string; service?: 'redirecter' | 'api' | 'renderer' | 'backup' }) {
    let env: any;

    const isLocalPlaywrightTest = process.env.STAMHOOFD_ENV === 'playwright' && process.env.NODE_ENV === 'test';

    if (!isLocalPlaywrightTest) {
        if (process.env.NODE_ENV && process.env.NODE_ENV === 'test') {
        // Force load the cjs version of test-utils because the esm version gives issues with the json environment
            const builder = await import('@stamhoofd/test-utils');
            await builder.TestUtils.loadEnvironment();
            env = STAMHOOFD;
        }
        else if (!settings?.path && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') && process.env.STAMHOOFD_ENV) {
            const builder = await import('@stamhoofd/build-development-env');
            env = await builder.build(process.env.STAMHOOFD_ENV ?? '', {
                backend: settings?.service ?? 'api',
            });

            if (await fileExists(settings?.path ?? '.env.json')) {
                console.warn(chalk.red('Warning: please delete your local .env.json file, as it is not used in development any longer.'));
            }
        }
        else {
            env = JSON.parse(fs.readFileSync(settings?.path ?? '.env.json', 'utf-8'));
        }

        // Read environment from file: .env.json
        (global as any).STAMHOOFD = env;
    }
    else {
        console.log('Skipping building environment for playwright tests');
    }

    // Mapping out environment for dependencies that need environment variables
    process.env.NODE_ENV = STAMHOOFD.environment === 'production' ? 'production' : 'development';

    if (settings?.service === 'redirecter') {
        return;
    }
    if (settings?.service === 'renderer') {
        return;
    }

    if (settings?.service === 'api') {
        if (!STAMHOOFD.domains) {
            throw new Error('Expected environment variable domains');
        }

        if (!STAMHOOFD.userMode || !['platform', 'organization'].includes(STAMHOOFD.userMode)) {
            throw new Error('Expected environment variable userMode');
        }

        if (!STAMHOOFD.translationNamespace) {
            throw new Error('Expected environment variable translationNamespace');
        }
    }

    if (!STAMHOOFD.DB_DATABASE) {
        throw new Error('Expected environment variable DB_DATABASE');
    }

    // Database
    process.env.DB_DATABASE = STAMHOOFD.DB_DATABASE + '';
    process.env.DB_HOST = STAMHOOFD.DB_HOST + '';
    process.env.DB_PASS = STAMHOOFD.DB_PASS + '';
    process.env.DB_USER = STAMHOOFD.DB_USER + '';

    // AWS
    process.env.AWS_ACCESS_KEY_ID = STAMHOOFD.AWS_ACCESS_KEY_ID + '';
    process.env.AWS_SECRET_ACCESS_KEY = STAMHOOFD.AWS_SECRET_ACCESS_KEY + '';
    process.env.AWS_REGION = STAMHOOFD.AWS_REGION + '';

    // Database
    process.env.DB_MULTIPLE_STATEMENTS = 'true';
}

export function signInternal(...content: string[]) {
    return crypto.createHmac('sha256', Buffer.from(STAMHOOFD.INTERNAL_SECRET_KEY, 'base64')).update(content.join(';')).digest('base64');
}

export function verifyInternalSignature(signature: string, ...content: string[]) {
    const newSignature = signInternal(...content);
    return crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(newSignature, 'base64'));
}

export default {
    load,
    signInternal,
    verifyInternalSignature,
};
