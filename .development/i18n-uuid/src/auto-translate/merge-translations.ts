import { Translations } from "../types/Translations";

export function mergeTranslations(a: Translations, b: Translations): Translations {
    return {
        ...a,
        ...b,
    };
}
