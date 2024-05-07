import { column, Model } from "@simonbackx/simple-database";
import { QueueHandler } from "@stamhoofd/queues";
import { Platform as PlatformStruct,PlatformConfig, PlatformPrivateConfig } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";


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

    @column({ type: "json", decoder: PlatformPrivateConfig })
    privateConfig: PlatformPrivateConfig = PlatformPrivateConfig.create({})

    static async getSharedStruct(): Promise<PlatformStruct> {
        const struct = await this.getSharedPrivateStruct();
        const clone = struct.clone();
        clone.privateConfig = null;

        return clone;
    }

    static async getSharedPrivateStruct(): Promise<PlatformStruct> {
        if (PlatformStruct.optionalShared) {
            return PlatformStruct.optionalShared;
        }

        return await QueueHandler.schedule('Platform.getSharedStruct', async () => {
            const model = await this.getShared();
            const struct = PlatformStruct.create(model);
            struct.setShared();

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
                await model.save();
            }

            return model;
        });
    }

    async save() {
        PlatformStruct.clearShared()
        return await super.save()
    }
}
