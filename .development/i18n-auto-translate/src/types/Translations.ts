export type Translations = Record<string, string>;

export type TranslationsWithConfig = Record<string, string> & {
    "consistent-words"?: Record<string, string>;
    extends?: string[];
    replacements?: Record<string, string>;
};
