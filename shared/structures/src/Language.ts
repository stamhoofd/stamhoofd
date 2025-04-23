export enum Language {
    Dutch = 'nl',
    English = 'en',
    French = 'fr',
}

export class LanguageHelper {
    /**
     * Get the name of a language in the language itself
     */
    static getNativeName(language: Language): string {
        switch (language) {
            case Language.Dutch:
                return 'Nederlands';
            case Language.English:
                return 'English';
            case Language.French:
                return 'Français';
            default:
                return '';
        }
    }
}
