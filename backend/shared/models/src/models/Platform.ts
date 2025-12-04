import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { QueryableModel } from '@stamhoofd/sql';
import { PlatformConfig, PlatformPrivateConfig, PlatformServerConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
import { deepFreeze } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { RegistrationPeriod } from './RegistrationPeriod.js';

export class Platform extends QueryableModel {
    static table = 'platform';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

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
            human: $t(`8a50ee7d-f37e-46cc-9ce7-30c7b37cefe8`),
        });
    }

    private static shared: Platform | null = null;
    private static sharedPrivateStruct: PlatformStruct & { privateConfig: PlatformPrivateConfig } | null = null;
    private static sharedStruct: PlatformStruct | null = null;

    static async getSharedStruct(): Promise<PlatformStruct> {
        if (!this.sharedStruct) {
            await this.loadCaches();
        }

        if (!this.sharedStruct || !!this.sharedStruct.privateConfig) {
            throw new Error('[Platform] Failed to load platform shared struct');
        }

        return this.sharedStruct;
    }

    async setPreviousPeriodId() {
        const period = await RegistrationPeriod.getByID(this.periodId);
        this.previousPeriodId = period?.previousPeriodId ?? null;
        this.nextPeriodId = period?.nextPeriodId ?? null;
    }

    static async getSharedPrivateStruct(): Promise<PlatformStruct & { privateConfig: PlatformPrivateConfig }> {
        if (!this.sharedPrivateStruct) {
            await this.loadCaches();
        }

        if (!this.sharedPrivateStruct || !this.sharedPrivateStruct.privateConfig) {
            throw new Error('[Platform] Failed to load platform shared private struct');
        }

        return this.sharedPrivateStruct;
    }

    static async getForEditing(): Promise<Platform> {
        return QueueHandler.schedule('Platform.getModel', async () => {
            // Build a new one
            let model = await this.getByID('1');

            if (!model) {
                console.info('[Platform] Creating new platform');

                // Create a new platform
                model = new Platform();
                model.id = '1';

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

    static async getShared(): Promise<Readonly<Platform> & { save: never }> {
        if (this.shared) {
            // Skip queue if possible (performance optimization)
            return this.shared as any;
        }

        return QueueHandler.schedule('Platform.getShared', async () => {
            if (this.shared) {
                return this.shared;
            }

            // Build a new one
            const model = await this.getForEditing();
            deepFreeze(model);
            this.shared = model;
            return model as any;
        });
    }

    static async loadCaches(): Promise<void> {
        await QueueHandler.schedule('Platform.loadCaches', async () => {
            if (this.sharedPrivateStruct && this.sharedStruct) {
                // Already loaded (possible if multiple calls to loadCaches were made)
                return;
            }
            // Build a new one
            const model = await this.getForEditing();
            await this.setCachesFromModel(model);
        });
    }

    private static async setCachesFromModel(model: Platform) {
        // Set structure cache
        const period = await RegistrationPeriod.getByID(model.periodId);
        const struct = PlatformStruct.create({
            ...model,
            period: period?.getStructure() ?? undefined,
        });

        // We clone to avoid the chance of updating the platform model
        this.sharedPrivateStruct = struct.clone() as PlatformStruct & { privateConfig: PlatformPrivateConfig };

        const clone = struct.clone();
        clone.privateConfig = null;
        clone.setShared();
        this.sharedStruct = clone;
    }

    static async clearCache() {
        await this.clearCacheWithoutRefresh();
        await this.loadCaches();
    }

    static async clearCacheWithoutRefresh() {
        await QueueHandler.schedule('Platform.loadCaches', async () => {
            this.sharedStruct = null;
            this.sharedPrivateStruct = null;
        });
        this.shared = null;
    }

    async save() {
        let update = false;
        if (this.existsInDatabase) {
            update = true;
        }
        const s = await super.save();

        if (update) {
            // Force update cache immediately
            await Platform.clearCache();
        }

        return s;
    }
}
