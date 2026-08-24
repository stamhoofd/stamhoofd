import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { QueryableModel } from '@stamhoofd/sql';
import { AuditLogReplacementDependencies, PlatformConfig, PlatformPrivateConfig, PlatformServerConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
import { uuidToName } from '@stamhoofd/structures/helpers/uuidToName.js';
import { deepFreeze } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { RegistrationPeriod } from './RegistrationPeriod.js';

export const ROOT_TENANT_ID = '1';

type TenantCache = {
    model: Readonly<Platform>;
    struct: PlatformStruct;
    privateStruct: PlatformStruct & { privateConfig: PlatformPrivateConfig };
};

export class Platform extends QueryableModel {
    static table = 'platform';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * The tenant this tenant belongs to. Null for a root tenant.
     */
    @column({ type: 'string', nullable: true })
    parentTenantId: string | null = null;

    /**
     * The tenant that charges this tenant for packages, transfer fees, service fees and invoices.
     * Only this may point outside the tenant's own subtree, and only at an ancestor.
     */
    @column({ type: 'string', nullable: true })
    feesTenantId: string | null = null;

    /**
     * Globally unique, shares its namespace with organizations.uri.
     */
    @column({ type: 'string', nullable: true })
    uri: string | null = null;

    @column({ type: 'string', nullable: true })
    domain: string | null = null;

    @column({ type: 'json', decoder: PlatformConfig })
    config: PlatformConfig = PlatformConfig.create({});

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'string', nullable: true })
    previousPeriodId: string | null = null;

    @column({ type: 'string', nullable: true })
    nextPeriodId: string | null = null;

    @column({ type: 'string', nullable: true })
    membershipOrganizationId: string | null = null;

    @column({ type: 'json', decoder: PlatformPrivateConfig })
    privateConfig: PlatformPrivateConfig = PlatformPrivateConfig.create({});

    /**
     * Invisible data for the frontend / structs - no matter your auhtorization level
     */
    @column({ type: 'json', decoder: PlatformServerConfig })
    serverConfig: PlatformServerConfig = PlatformServerConfig.create({});

    /**
     * Throws an error if userMode is not platform.
     * The period id of the platform should almost never be used if the userMode is not platform.
     * By throwing an error, we prevent accidental usage of the period id.
     */
    get periodIdIfPlatform() {
        if (STAMHOOFD.userMode === 'platform') {
            return this.periodId;
        }

        throw new SimpleError({
            code: 'only_platform',
            message: 'Period id should only be used if userMode is platform',
            human: $t(`%1AD`),
        });
    }

    private static caches: Map<string, TenantCache> = new Map();

    static async getStructForTenant(tenantId: string): Promise<PlatformStruct> {
        const struct = (await this.getCache(tenantId)).struct;

        if (struct.privateConfig) {
            throw new Error('[Platform] Failed to load platform shared struct');
        }

        return struct;
    }

    static async getSharedStruct(): Promise<PlatformStruct> {
        return await this.getStructForTenant(ROOT_TENANT_ID);
    }

    async setPreviousPeriodId() {
        const period = await RegistrationPeriod.getByID(this.periodId);
        this.previousPeriodId = period?.previousPeriodId ?? null;
        this.nextPeriodId = period?.nextPeriodId ?? null;
    }

    static async getPrivateStructForTenant(tenantId: string): Promise<PlatformStruct & { privateConfig: PlatformPrivateConfig }> {
        const privateStruct = (await this.getCache(tenantId)).privateStruct;

        if (!privateStruct.privateConfig) {
            throw new Error('[Platform] Failed to load platform shared private struct');
        }

        return privateStruct;
    }

    static async getSharedPrivateStruct(): Promise<PlatformStruct & { privateConfig: PlatformPrivateConfig }> {
        return await this.getPrivateStructForTenant(ROOT_TENANT_ID);
    }

    /**
     * Both columns are nullable. Blank input is rejected so a caller cannot ask for "the tenant with
     * no uri" — SQL would not match NULL with '=' anyway, but an explicit reject beats relying on it.
     */
    static async getByURI(uri: string): Promise<Platform | undefined> {
        if (!uri) {
            return undefined;
        }

        return await this.select().where('uri', uri).first(false) ?? undefined;
    }

    static async getByDomain(domain: string): Promise<Platform | undefined> {
        if (!domain) {
            return undefined;
        }

        return await this.select().where('domain', domain).first(false) ?? undefined;
    }

    static async getForEditing(tenantId: string = ROOT_TENANT_ID): Promise<Platform> {
        return QueueHandler.schedule('Platform.getModel-' + tenantId, async () => {
            // Build a new one
            let model = await this.getByID(tenantId);

            if (!model) {
                if (tenantId !== ROOT_TENANT_ID) {
                    // Only the root tenant bootstraps itself. Any other tenant is created explicitly.
                    throw new SimpleError({
                        code: 'tenant_not_found',
                        message: 'Tenant ' + tenantId + ' not found',
                        statusCode: 404,
                    });
                }

                console.info('[Platform] Creating new platform');

                // Create a new platform
                model = new Platform();
                model.id = tenantId;
                model.feesTenantId = model.id;
                model.uri = STAMHOOFD.platformName;
                model.domain = STAMHOOFD.domains.dashboard ?? null;

                if (STAMHOOFD.userMode === 'platform') {
                    model.periodId = (await RegistrationPeriod.all())[0].id;
                }
                else {
                    const period = await RegistrationPeriod.select().where('organizationId', null).first(true);
                    model.periodId = period.id;
                }

                await model.save();
            }

            return model;
        });
    }

    static async getForTenant(tenantId: string): Promise<Readonly<Platform> & { save: never }> {
        return (await this.getCache(tenantId)).model as any;
    }

    static async getShared(): Promise<Readonly<Platform> & { save: never }> {
        return await this.getForTenant(ROOT_TENANT_ID);
    }

    private static async getCache(tenantId: string): Promise<TenantCache> {
        const cached = this.caches.get(tenantId);
        if (cached) {
            // Skip queue if possible (performance optimization)
            return cached;
        }

        await this.loadCachesForTenant(tenantId);

        const loaded = this.caches.get(tenantId);
        if (!loaded) {
            throw new Error('[Platform] Failed to load caches for tenant ' + tenantId);
        }
        return loaded;
    }

    static async loadCachesForTenant(tenantId: string): Promise<void> {
        // Keyed per tenant: a global key would stall every tenant behind one tenant's reload.
        await QueueHandler.schedule('Platform.loadCaches-' + tenantId, async () => {
            if (this.caches.has(tenantId)) {
                // Already loaded (possible if multiple calls were made)
                return;
            }
            const model = await this.getForEditing(tenantId);
            await this.setCachesFromModel(model);
        });
    }

    static async loadCaches(): Promise<void> {
        await this.loadCachesForTenant(ROOT_TENANT_ID);
    }

    private static async setCachesFromModel(model: Platform) {
        // Set structure cache
        const period = await RegistrationPeriod.getByID(model.periodId);
        const struct = PlatformStruct.create({
            ...model,
            period: period?.getStructure() ?? undefined,
        });

        // We clone to avoid the chance of updating the platform model
        const privateStruct = struct.clone() as PlatformStruct & { privateConfig: PlatformPrivateConfig };

        const clone = struct.clone();
        clone.privateConfig = null;

        if (model.id === ROOT_TENANT_ID) {
            // Audit logs render uuids from a bare id, so they cannot receive a platform through their
            // call chain. Bind the resolver to the struct we are about to cache, so it is refreshed
            // together with the caches. Uses the public struct on purpose: resolving privateConfig
            // roles would change the names that get persisted in audit logs.
            // Still process-wide: it becomes tenant-aware once a request carries its tenant.
            AuditLogReplacementDependencies.uuidToName = uuid => uuidToName(uuid, clone);
        }

        deepFreeze(model);

        this.caches.set(model.id, {
            model,
            struct: clone,
            privateStruct,
        });
    }

    static async clearCacheForTenant(tenantId: string) {
        await this.clearCacheForTenantWithoutRefresh(tenantId);
        await this.loadCachesForTenant(tenantId);
    }

    static async clearCacheForTenantWithoutRefresh(tenantId: string) {
        await QueueHandler.schedule('Platform.loadCaches-' + tenantId, async () => {
            this.caches.delete(tenantId);
        });
    }

    static async clearCache() {
        await this.clearCacheForTenant(ROOT_TENANT_ID);
    }

    static async clearCacheWithoutRefresh() {
        await this.clearCacheForTenantWithoutRefresh(ROOT_TENANT_ID);
    }

    async save() {
        let update = false;
        if (this.existsInDatabase) {
            update = true;
        }
        const s = await super.save();

        if (update) {
            // Only this tenant's cache: another tenant's is unaffected by this save.
            await Platform.clearCacheForTenant(this.id);
        }

        return s;
    }
}
