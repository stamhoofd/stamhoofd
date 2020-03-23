import { Model } from "../classes/Model";
import { ManyToOneRelation } from '../classes/ManyToOneRelation';

/**
 * 
 * @param _settings
 */
export function manyToOne(settings: { key: string; model: typeof Model }) {
    return (target: any, key) => {

        const relation = new ManyToOneRelation(settings.model, key, settings.key);

        if (!target.constructor.relations) {
            target.constructor.relations = []
        }

        target.constructor.relations.push(relation)
    };
}
