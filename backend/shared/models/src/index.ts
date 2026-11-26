import { Model, registerModelTarget } from '@node/database';
import * as catalog from './models/index.js';

for (const model of Object.values(catalog)) {
    if (
        typeof model === 'function' &&
        model.prototype instanceof Model &&
        'table' in model &&
        typeof model.table === 'string'
    )
        registerModelTarget(model as typeof Model);
}

// Helpers
export * from './helpers/RateLimiter.js';
export * from './helpers/WebshopCounter.js';

// Models
export * from './models/index.js';
export * from './structures/OrganizationServerMetaData.js';

// Factories
export * from './factories/index.js';
