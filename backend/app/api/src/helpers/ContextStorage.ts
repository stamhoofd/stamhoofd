import { AsyncLocalStorage } from 'async_hooks';

import type { SessionContextStorageValue } from './SessionContextStorageValue.js';

export const contextStorage = new AsyncLocalStorage<SessionContextStorageValue>();

export function getSessionContextRequest() {
    return contextStorage.getStore()?.request;
}
