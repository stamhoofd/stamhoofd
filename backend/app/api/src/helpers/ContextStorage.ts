import { AsyncLocalStorage } from 'async_hooks';

import type { ContextInstance } from './Context.js';

export const contextStorage = new AsyncLocalStorage<ContextInstance>();
