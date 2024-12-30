import { column } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { QueryableModel } from '@stamhoofd/sql';
import { PlatformConfig, PlatformPrivateConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
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

    static sharedStruct: PlatformStruct | null = null;

    static async getSharedStruct(): Promise<PlatformStruct> {
        const struct: PlatformStruct = await this.getSharedPrivateStruct();
        const clone = struct.clone();
        clone.privateConfig = null;
        clone.setShared();

        return clone;
    }

    async setPreviousPeriodId() {
        const period = await RegistrationPeriod.getByID(this.periodId);
        this.previousPeriodId = period?.previousPeriodId ?? null;
    }

    static async getSharedPrivateStruct(): Promise<PlatformStruct & { privateConfig: PlatformPrivateConfig }> {
        if (this.sharedStruct && this.sharedStruct.privateConfig) {
            return this.sharedStruct as any;
        }

        return await QueueHandler.schedule('Platform.getSharedStruct', async () => {
            const model = await this.getShared();
            const period = await RegistrationPeriod.getByID(model.periodId);
            const struct = PlatformStruct.create({
                ...model,
                period: period?.getStructure() ?? undefined,
            });
            this.sharedStruct = struct;

            return struct as any;
        });
    }

    static async getShared(): Promise<Platform> {
        return QueueHandler.schedule('Platform.getShared', async () => {
            // Build a new one
            let model = await this.getByID('1');
            if (!model) {
                // Create a new platform
                model = new Platform();
                model.id = '1';
                model.periodId = (await RegistrationPeriod.all())[0].id;
                await model.save();
            }

            return model;
        });
    }

    static clearCache() {
        this.sharedStruct = null;
    }

    async save() {
        const s = await super.save();
        Platform.clearCache();

        // Force update cache immediately
        await Platform.getSharedStruct();

        return s;
    }
}
