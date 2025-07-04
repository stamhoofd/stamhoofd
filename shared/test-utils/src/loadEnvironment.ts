import testEnv from './env.json';
// import { read1PasswordCli } from '@stamhoofd/build-development-env';

export async function loadEnvironment() {
    let globalObject: any = null;
    if (typeof window === 'object') {
        globalObject = window;
    }

    if (typeof global === 'object') {
        globalObject = global;
    }

    if (typeof self === 'object') {
        globalObject = self;
    }

    (globalObject as any).STAMHOOFD = JSON.parse(JSON.stringify(testEnv)); // deep clone

    if (!globalObject.$t) {
        (globalObject as any).$t = (key: string, replace?: Record<string, string>) => key;
    }
    if (!globalObject.$getLanguage) {
        (globalObject as any).$getLanguage = () => 'nl';
    }
    if (!globalObject.$getCountry) {
        (globalObject as any).$getCountry = () => 'BE';
    }

    // Database
    process.env.DB_DATABASE = (STAMHOOFD as any).DB_DATABASE + '';
    process.env.DB_HOST = (STAMHOOFD as any).DB_HOST + '';
    process.env.DB_PASS = (STAMHOOFD as any).DB_PASS + '';
    process.env.DB_USER = (STAMHOOFD as any).DB_USER + '';

    // Database
    process.env.DB_MULTIPLE_STATEMENTS = 'true';

    // (STAMHOOFD as any).UITPAS_API_CLIENT_ID = await read1PasswordCli('op://Localhost/hjnat3l3mj2rojlyiwluqzurci/client ID');
    // (STAMHOOFD as any).UITPAS_API_CLIENT_SECRET = await read1PasswordCli('op://Localhost/hjnat3l3mj2rojlyiwluqzurci/client secret');
}
