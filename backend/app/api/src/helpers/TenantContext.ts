import { SimpleError } from '@simonbackx/simple-errors';
import { Platform, ROOT_TENANT_ID } from '@stamhoofd/models';
import type { PlatformPrivateConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
import { AsyncLocalStorage } from 'async_hooks';

export class TenantContextInstance {
    readonly tenantId: string;

    constructor(tenantId: string) {
        this.tenantId = tenantId;
    }

    async getTenant(): Promise<Readonly<Platform>> {
        return await Platform.getForTenant(this.tenantId);
    }

    async getStruct(): Promise<PlatformStruct> {
        return await Platform.getStructForTenant(this.tenantId);
    }

    async getPrivateStruct(): Promise<PlatformStruct & { privateConfig: PlatformPrivateConfig }> {
        return await Platform.getPrivateStructForTenant(this.tenantId);
    }
}

/**
 * The tenant the current work belongs to.
 *
 * Separate from Context on purpose: crons, migrations and queued jobs run for a fixed tenant with no
 * request, no authentication and no user, so a request-scoped context cannot carry them.
 */
export class TenantContext {
    private static asyncLocalStorage = new AsyncLocalStorage<TenantContextInstance>();

    static get optional(): TenantContextInstance | null {
        return this.asyncLocalStorage.getStore() ?? null;
    }

    static get current(): TenantContextInstance {
        const c = this.optional;

        if (!c) {
            throw new SimpleError({
                code: 'no_tenant_context',
                message: 'No tenant context found',
                statusCode: 500,
            });
        }

        return c;
    }

    /**
     * The current tenant, or the root tenant when nothing has entered a scope yet.
     *
     * Only for call sites that have not been given a tenant yet. Anything that already runs for a
     * known tenant should use current, so a missing scope fails loudly instead of quietly reading
     * the root tenant.
     */
    static get currentOrRoot(): TenantContextInstance {
        return this.optional ?? new TenantContextInstance(ROOT_TENANT_ID);
    }

    static async run<T>(tenantId: string, handler: () => Promise<T>): Promise<T> {
        return await this.asyncLocalStorage.run(new TenantContextInstance(tenantId), handler);
    }
}
