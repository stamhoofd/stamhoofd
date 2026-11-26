import { requestSpanIds } from './request-span-state.js';

/** Read-only lookup for the dedicated response log writer. Importing it starts no SDK or exporter. */
export function sampledResponseIds(request: object) {
    return requestSpanIds.get(request);
}
