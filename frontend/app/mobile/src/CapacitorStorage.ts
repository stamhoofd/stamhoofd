import { Preferences as Storage } from '@capacitor/preferences';
import { KeyValueContainer } from "@stamhoofd/networking"

export class CapacitorStorage implements KeyValueContainer {
    async setItem(key: string, value: string): Promise<void> {
        await Storage.set({
            key,
            value
        });
    }
    async getItem(key: string): Promise<string | null> {
        return (await Storage.get({
            key
        })).value;
    }
    async removeItem(key: string): Promise<void> {
        await Storage.remove({
            key
        });
    }

}