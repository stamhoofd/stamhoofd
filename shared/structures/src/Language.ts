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

    static getName(language: Language): string {
        switch (language) {
            case Language.Dutch:
                return $t('0b0e2784-8439-4fc8-a317-69e307c327f7');
            case Language.English:
                return $t('61a07c8a-ff52-443e-86c9-c5a39aa56114');
            case Language.French:
                return $t('78797ba0-580e-4e41-b876-4d2b31c87e7e');
            default:
                return '';
        }
    }
}
