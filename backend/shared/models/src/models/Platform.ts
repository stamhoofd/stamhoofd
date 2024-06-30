import { column, Model } from "@simonbackx/simple-database";
import { QueueHandler } from "@stamhoofd/queues";
import { Platform as PlatformStruct,PlatformConfig, PlatformPrivateConfig } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";
import { RegistrationPeriod } from "./RegistrationPeriod";


export class Platform extends Model {
    static table = "platform";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "json", decoder: PlatformConfig })
    config: PlatformConfig = PlatformConfig.create({})

    @column({ type: "string" })
    periodId: string

    @column({ type: "json", decoder: PlatformPrivateConfig })
    privateConfig: PlatformPrivateConfig = PlatformPrivateConfig.create({})

    static sharedStruct: PlatformStruct | null = null;

    static async getSharedStruct(): Promise<PlatformStruct> {
        const struct = await this.getSharedPrivateStruct();
        const clone = struct.clone();
        clone.privateConfig = null;
        clone.setShared();

        return clone;
    }

    static async getSharedPrivateStruct(): Promise<PlatformStruct> {
        if (this.sharedStruct && this.sharedStruct.privateConfig) {
            return this.sharedStruct;
        }

        return await QueueHandler.schedule('Platform.getSharedStruct', async () => {
            const model = await this.getShared();
            const period = await RegistrationPeriod.getByID(model.periodId);
            const struct = PlatformStruct.create({
                ...model,
                period: period?.getStructure() ?? undefined
            });
            this.sharedStruct = struct;

            return struct;
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

    async save() {
        Platform.sharedStruct = null
        return await super.save()
    }
}
