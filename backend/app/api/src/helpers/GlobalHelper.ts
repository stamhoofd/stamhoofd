import { Context } from './Context';

export class GlobalHelper {
    static load() {
        this.loadGlobalTranslateFunction();
    }

    private static loadGlobalTranslateFunction() {
        (global as any).$t = (key: string, replace?: Record<string, string>) => Context.i18n.$t(key, replace);
    }
}
