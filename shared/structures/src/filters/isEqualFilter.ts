import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import { Version } from '../Version.js';
import { StamhoofdFilterDecoder } from './StamhoofdFilterDecoder.js';

export function isEqualFilter(a: StamhoofdFilter | null, b: StamhoofdFilter | null) {
    if (a === null) {
        return b === null;
    }

    if (b === null) {
        return false;
    }

    return JSON.stringify(StamhoofdFilterDecoder.encode(a, { version: Version })) === JSON.stringify(StamhoofdFilterDecoder.encode(b, { version: Version }));
}
