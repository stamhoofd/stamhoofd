import { AutoEncoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from './QueryableModel.js';
import { LRUCache } from 'lru-cache';

/**
 * There simply is no reason not to cache data in memory for the most used models.
 */
export class ModelCache<M extends QueryableModel> {
    cache = new LRUCache<string | number, M>({
        max: 1000,
    });

    getById(id: string | number) {
        const base = this.cache.get(id);
        if (!base) {
            return base;
        }
        return this.deepClone(base);
    }

    deepClone(model: M): M {
        const copy = new model.static();
        copy.copyFrom(model);

        for (const column of copy.static.columns.values()) {
            try {
                this[column.name] = structuredClone(model[column.name]);
            }
            catch (e) {
                console.log('Error on clone', copy.static.name, column.name, e);
                // structured clone error
                if (model[column.name] instanceof AutoEncoder) {
                    this[column.name] = model[column.name].clone();
                }
                else {
                    this[column.name] = model[column.name];
                }
            }
        }

        if (!copy.existsInDatabase) {
            throw new Error('Unexpected not exists');
        }

        return copy as M;
    }

    store(model: M) {
        const clone = this.deepClone(model);
        const id = clone.getPrimaryKey();
        if (!id) {
            console.warn('Could not store in cache: no id found', model);
            return;
        }
        this.cache.set(id, model);
    }

    clearId(id: string | number) {
        this.cache.delete(id);
    }
}
