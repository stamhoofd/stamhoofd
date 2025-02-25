import { I18n } from '@stamhoofd/backend-i18n';
import { FileSignService } from '../services/FileSignService';
import { Context, ContextInstance } from './Context';
import { Address, Country } from '@stamhoofd/structures';

export class GlobalHelper {
    static async load() {
        await I18n.load();
        this.loadGlobalTranslateFunction();
        await FileSignService.load();
    }

    private static loadGlobalTranslateFunction() {
        (global as any).$t = (key: string, replace?: Record<string, string>) => Context.i18n.$t(key, replace);
        (global as any).$getLanguage = () => ContextInstance.optional?.i18n.language ?? 'nl';
        (global as any).$getCountry = () => ContextInstance.optional?.i18n.country ?? STAMHOOFD.fixedCountry ?? Country.Belgium;
    }
}
