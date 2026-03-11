import fs from "fs";
import { decodeBase62, isBase62 } from "./compress-uuids";

export function writeMultipleTranslations(translationsWithPath: Map<string, Record<string, string>>) {
    for (const [filePath, translations] of translationsWithPath) {
        writeTranslation(filePath, translations);
    }
}

const fixedOrder = ['extends', 'replacements']
export function sortObjectKeysForEncoding(a: string, b: string) {
    // Always have a fixed order for certain keys, and follow with alphabetical order
    // id, name, description, ...remaining
    if (a === b) {
        return 0;
    }

    for (const fixed of fixedOrder) {
        if (a === fixed) {
            return -1;
        }

        if (b === fixed) {
            return 1;
        }
    }
    const ba = isBase62(a);
    const bb = isBase62(b);

    if (!ba && bb) {
        return -1;
    }

    if (ba && !bb) {
        return 1;
    }

    if (ba && bb) {
        const aa = decodeBase62(a);
        const bb = decodeBase62(b);
        if (aa < bb) {
            return -1;
        }
        if (bb > aa) {
            return 1;
        }
        return 0;
    }

    return a.localeCompare(b);
}


export function writeTranslation(filePath: string, translations: Record<string, string>) {
    // Sort keys
    const keys = Object.keys(translations).sort(sortObjectKeysForEncoding);
    const encodedObj = {};
    for (const key of keys) {
        encodedObj[key] = translations[key]
    }
    fs.writeFileSync(filePath, JSON.stringify(encodedObj, null, 2));
}
