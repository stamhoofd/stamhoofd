import { TranslationDictionary } from "../types/TranslationDictionary";
import { Translations } from "../types/Translations";

export function validateTranslations(
    translations: Translations
): { valid: boolean; message?: string } {
    if (typeof translations !== "object" || Array.isArray(translations)) {
        return {
            valid: false,
            message: "translations must be an object",
        };
    }

    for (const [key, value] of Object.entries(translations)) {
        if (key === "replacements") {
            const validationResult = validateReplacements(value);

            if (validationResult.valid === false) {
                return validationResult;
            }
            continue;
        }

        if (key === "extends") {
            const validationResult = validateExtends(value);

            if (validationResult.valid === false) {
                return validationResult;
            }
            continue;
        }

        if (typeof value !== "string") {
            return {
                valid: false,
                message: `translations.${key} must be a string`,
            };
        }
    }

    return {
        valid: true,
    };
}

function validateReplacements(replacements: any): {
    valid: boolean;
    message?: string;
} {
    if (typeof replacements !== "object" || Array.isArray(replacements)) {
        return {
            valid: false,
            message: "replacements must be an object",
        };
    }

    for (const [key, value] of Object.entries(replacements)) {
        if (typeof value !== "string") {
            return {
                valid: false,
                message: `replacements.${key} must be a string`,
            };
        }
    }

    return {
        valid: true,
    };
}

function validateExtends(extendsArray: any): {
    valid: boolean;
    message?: string;
} {
    if (!Array.isArray(extendsArray)) {
        return {
            valid: false,
            message: "extends must be an array",
        };
    }

    if (extendsArray.some((value) => typeof value !== "string")) {
        return {
            valid: false,
            message: "extends must be an array of strings",
        };
    }

    return {
        valid: true,
    };
}

export function validateConsistentWords(consistentWordsRecord: any): {
    valid: boolean;
    message?: string;
} {
    if (
        typeof consistentWordsRecord !== "object" ||
        Array.isArray(consistentWordsRecord)
    ) {
        return {
            valid: false,
            message: "consistent-words must be an object",
        };
    }

    for (const [key, value] of Object.entries(consistentWordsRecord)) {
        if (typeof value !== "string") {
            return {
                valid: false,
                message: `consistent-words.${key} must be a string`,
            };
        }

        if (typeof key !== "string") {
            return {
                valid: false,
                message: `consistent-words key ${key} must be a string`,
            };
        }

        if (key.length < 1) {
            return {
                valid: false,
                message: `consistent-words key ${key} must be at least 1 character long`,
            };
        }

        if (value.trim().length === 0) {
            return {
                valid: false,
                message: `consistent-words.${key} must be at least 1 character long`,
            };
        }
    }

    return {
        valid: true,
    };
}

export function validateTranslationDictionary(dictionary: TranslationDictionary): { valid: boolean; message?: string } {
    if (typeof dictionary !== "object" || Array.isArray(dictionary)) {
        return {
            valid: false,
            message: "translation dictionary must be an object",
        };
    }

    for (const [key, value] of Object.entries(dictionary)) {
        if(typeof key !== "string") {
            return {
                valid: false,
                message: `translation dictionary key ${key} must be a string`,
            };
        }

        if (typeof value !== "object" || Array.isArray(value)) {
            return {
                valid: false,
                message: "translation dictionary value must be an object",
            };
        }

        for(const [key2, value2] of Object.entries(value)) {
            if(key2 === 'original' || key2 === 'translation') {
                if(typeof value2 !== "string") {
                    return {
                        valid: false,
                        message: `translation dictionary ${key2} must be a string for key ${key}`,
                    };
                }
                continue;
            }

            return {
                valid: false,
                message: `Unknown translation dictionary key ${key2} for key ${key}`,
            }
        }
    }

    return {
        valid: true,
    };
}
