import testEnv from './env.json';

export function loadEnvironment() {
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

    (globalObject as any).$t = (key: string, replace?: Record<string, string>) => key;
    (globalObject as any).$getLanguage = () => 'nl';
    (globalObject as any).$getCountry = () => 'BE';
}
