import type { Request, RequestMiddleware } from '@simonbackx/simple-endpoints';
import { ROOT_TENANT_ID } from '@stamhoofd/models';

import { TenantContext } from '../helpers/TenantContext.js';

/**
 * Puts every request in a tenant scope.
 *
 * Every request resolves to the deployment's root tenant for now. Resolving it from the host is a
 * later step; this exists so the scope is already there when it starts to matter.
 *
 * Register this *after* ContextMiddleware: wrapRun wrappers are applied in registration order, so
 * the last one registered is the outermost. The tenant has to be in scope before the context that
 * reads it.
 */
export const TenantScopeMiddleware: RequestMiddleware = {
    wrapRun<T>(run: () => Promise<T>, _request: Request) {
        return TenantContext.run(ROOT_TENANT_ID, run);
    },

    handleRequest() {
        // Noop
    },
};
