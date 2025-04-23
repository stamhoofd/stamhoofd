import { I18n } from '@stamhoofd/backend-i18n';
import { FileSignService } from '../services/FileSignService';
import { Context, ContextInstance } from './Context';
import { MemberRecordStore } from '../services/MemberRecordStore';

export class GlobalHelper {
    static async load() {
        await I18n.load();
        this.loadGlobalTranslateFunction();
        await FileSignService.load();
        MemberRecordStore.init();
    }

    private static loadGlobalTranslateFunction() {
        function getI18n() {
            return ContextInstance.optional?.i18n ?? new I18n(I18n.defaultLanguage, STAMHOOFD.fixedCountry ?? I18n.defaultCountry);
        }
        (global as any).$t = (key: string, replace?: Record<string, string>) => getI18n().$t(key, replace);
        (global as any).$getLanguage = () => getI18n().language;
        (global as any).$getCountry = () => getI18n().country;
    }
}
