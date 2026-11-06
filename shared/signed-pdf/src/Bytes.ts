/**
 * Byte helpers for scanning a PDF without decoding it to a string. A PDF is not text in any single
 * encoding, and the offsets in a signature's byte range are byte offsets, so every position here
 * has to stay a byte position.
 */

/** Space, tab, carriage return, line feed, form feed and null, per the PDF specification. */
const WHITESPACE = new Set([0x20, 0x09, 0x0d, 0x0a, 0x0c, 0x00]);

export function isPdfWhitespace(byte: number | undefined): boolean {
    return byte !== undefined && WHITESPACE.has(byte);
}

export function asciiBytes(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);

    for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i) & 0xff;
    }

    return bytes;
}

export function startsWithAscii(bytes: Uint8Array, text: string, at: number): boolean {
    if (at < 0 || at + text.length > bytes.length) {
        return false;
    }

    for (let i = 0; i < text.length; i++) {
        if (bytes[at + i] !== (text.charCodeAt(i) & 0xff)) {
            return false;
        }
    }

    return true;
}

export function indexOfAscii(bytes: Uint8Array, text: string, from = 0): number {
    const needle = asciiBytes(text);
    const last = bytes.length - needle.length;

    for (let at = Math.max(0, from); at <= last; at++) {
        let matches = true;

        for (let i = 0; i < needle.length; i++) {
            if (bytes[at + i] !== needle[i]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return at;
        }
    }

    return -1;
}

export function indexesOfAscii(bytes: Uint8Array, text: string): number[] {
    const found: number[] = [];

    for (let at = indexOfAscii(bytes, text); at !== -1; at = indexOfAscii(bytes, text, at + 1)) {
        found.push(at);
    }

    return found;
}

/** Decodes an ASCII string, for the short names and values read out of a PDF dictionary. */
export function decodeAscii(bytes: Uint8Array, start: number, end: number): string {
    let text = '';

    for (let i = start; i < end; i++) {
        text += String.fromCharCode(bytes[i]);
    }

    return text;
}

function hexValue(byte: number): number {
    if (byte >= 0x30 && byte <= 0x39) {
        return byte - 0x30;
    }

    if (byte >= 0x41 && byte <= 0x46) {
        return byte - 0x41 + 10;
    }

    if (byte >= 0x61 && byte <= 0x66) {
        return byte - 0x61 + 10;
    }

    return -1;
}

/**
 * Decodes the hexadecimal string between `start` and `end`, skipping whitespace. Returns null when
 * it holds anything but hexadecimal digits, or an odd number of them.
 */
export function decodeHex(bytes: Uint8Array, start: number, end: number): Uint8Array | null {
    const decoded = new Uint8Array(Math.ceil((end - start) / 2));
    let length = 0;
    let high = -1;

    for (let i = start; i < end; i++) {
        if (isPdfWhitespace(bytes[i])) {
            continue;
        }

        const value = hexValue(bytes[i]);

        if (value === -1) {
            return null;
        }

        if (high === -1) {
            high = value;
        } else {
            decoded[length++] = (high << 4) | value;
            high = -1;
        }
    }

    if (high !== -1) {
        return null;
    }

    return decoded.subarray(0, length);
}

/**
 * Copies into a plain `ArrayBuffer`. WebCrypto and pkijs only accept one, while a `Uint8Array` may
 * be a view on a larger or shared buffer, so handing over `.buffer` is both wrong and unsafe.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);

    return copy.buffer;
}
