import { column } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { QueryableModel } from '@stamhoofd/sql';
import { PlatformConfig, PlatformPrivateConfig, PlatformServerConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
import { deepFreeze } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { RegistrationPeriod } from './RegistrationPeriod';

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
    membershipOrganizationId: string | null = null;

    @column({ type: 'json', decoder: PlatformPrivateConfig })
    privateConfig: PlatformPrivateConfig = PlatformPrivateConfig.create({});

    /**
     * Invisible data for the frontend / structs - no matter your auhtorization level
     */
    @column({ type: 'json', decoder: PlatformServerConfig })
    serverConfig: PlatformServerConfig = PlatformServerConfig.create({});

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
                model.periodId = (await RegistrationPeriod.all())[0].id;
                await model.save();
            }

            return model;
        });
    }

    static async getShared(): Promise<Readonly<Platform> & { save: never }> {
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
        await QueueHandler.schedule('Platform.loadCaches', async () => {
            this.sharedStruct = null;
            this.sharedPrivateStruct = null;
        });
        await QueueHandler.schedule('Platform.getShared', async () => {
            this.shared = null;
        });
        await this.loadCaches();
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
