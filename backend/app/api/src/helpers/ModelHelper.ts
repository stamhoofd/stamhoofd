import { Model } from '@simonbackx/simple-database';

// todo: move for reuse?
type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

export class ModelHelper {
    static async loop<M extends typeof Model>(m: M, idKey: KeysMatching<InstanceType<M>, string> & string, onBatchReceived: (batch: InstanceType<M>[]) => Promise<void>, options: { limit?: number } = {}) {
        let lastId = '';
        const limit = options.limit ?? 10;

        while (true) {
            const models = await m.where(
                { [idKey]: { sign: '>', value: lastId } },
                { limit, sort: [idKey] });

            if (models.length < limit) {
                break;
            }

            await onBatchReceived(models);

            lastId
                    = models[
                    models.length - 1
                ][idKey] as string;
        }
    }
}
