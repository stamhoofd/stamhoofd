import { Readable } from 'node:stream';

export function isReadableStream(val: unknown): val is Readable {
    return val !== null
        && typeof val === 'object'
        && 'pipe' in val
        && '_read' in val
        && '_readableState' in val
        && typeof val.pipe === 'function'
        && typeof val._read === 'function'
        && typeof val._readableState === 'object';
}
