import { Translations } from "./types/Translations";

export function validateTranslations(translations: Translations): {valid: boolean, message?: string} {
    if(typeof translations !== "object" || Array.isArray(translations)) {
        return {
            valid: false,
            message: 'translations must be an object',
        };
    }

    for(const [key, value] of Object.entries(translations)) {
        if(key === 'replacements') {
            const validationResult = validateReplacements(value);

            if(validationResult.valid === false) {
                return validationResult;
            }
            continue;
        }

        if(key === 'extends') {
            const validationResult = validateExtends(value);

            if(validationResult.valid === false) {
                return validationResult;
            }
            continue;
        }

        if(typeof value !== 'string') {
            return {
                valid: false,
                message: `translations.${key} must be a string`,
            };
        }
    }

    return {
        valid: true
    };
}


function validateReplacements(replacements: any): {valid: boolean, message?: string} {
    if(typeof replacements !== "object" || Array.isArray(replacements)) {
        return {
            valid: false,
            message: 'replacements must be an object',
        };
    }

    for(const [key, value] of Object.entries(replacements)) {

        if(typeof value !== 'string') {
            return {
                valid: false,
                message: `replacements.${key} must be a string`,
            };
        }
    }

    return {
        valid: true
    }
}

function validateExtends(extendsArray: any): {valid: boolean, message?: string} {
    if(!Array.isArray(extendsArray)) {
        return {
            valid: false,
            message: 'extends must be an array',
        };
    }

    if(extendsArray.some(value => typeof value !== 'string')) {
        return {
            valid: false,
            message: 'extends must be an array of strings',
        };
    }

    return {
        valid: true
    }
}
