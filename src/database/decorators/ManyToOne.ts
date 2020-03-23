import { Model } from "../classes/Model";
import { ToOneRelation } from '../classes/ToOneRelation';

/**
 * 
 * @param _settings
 */
export function manyToOne(settings: { key: string; model: typeof Model }) {
    return (target: any, key) => {

        const relation = new ToOneRelation();
        relation.foreignKey = settings.key
        relation.modelKey = key
        relation.model = settings.model

        if (!target.constructor.relations) {
            target.constructor.relations = []
        }

        target.constructor.relations.push(relation)
    };
}
