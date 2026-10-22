const START_CHAR = '%';
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function isBase62(str: string) {
    if (str.length > 10) {
        return false;
    }
    if (!str.startsWith(START_CHAR)) {
        return false;
    }

    try {
        decodeBase62(str);
        return true;
    }
    catch (e) {
        return false;
    }
}

export function encodeBase62(num: number): string {
    if (num === 0) return START_CHAR + '0';

    let result = '';
    while (num > 0) {
        result = BASE62_CHARS[num % 62] + result;
        num = Math.floor(num / 62);
    }
    return START_CHAR + result;
}

export function decodeBase62(str: string): number {
    return str.substring(START_CHAR.length).split('').reduce((acc, char) => {
        const index = BASE62_CHARS.indexOf(char);
        if (index === -1) throw new Error(`Invalid Base62 character: '${char}'`);
        return acc * 62 + index;
    }, 0);
}
