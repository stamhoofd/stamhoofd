import testEnv from './env.json';
// import { read1PasswordCli } from '@stamhoofd/build-development-env';

export function getGlobalObject() {
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

    return (globalObject as any);
}

export function updateLinkedEnvs() {
    // Database
    process.env.DB_DATABASE = (STAMHOOFD as any).DB_DATABASE + '';
    process.env.DB_HOST = (STAMHOOFD as any).DB_HOST + '';
    process.env.DB_PASS = (STAMHOOFD as any).DB_PASS + '';
    process.env.DB_USER = (STAMHOOFD as any).DB_USER + '';

    // Database
    process.env.DB_MULTIPLE_STATEMENTS = 'true';
}

export async function loadEnvironment() {
    const globalObject = getGlobalObject();
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
    updateLinkedEnvs();
}
