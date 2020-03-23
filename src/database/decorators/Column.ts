import { Model } from '../classes/Model';
import { ToOneRelation } from '../classes/ToOneRelation';

export function column(settings?: { primary?: boolean; relation?: ToOneRelation<string, typeof Model> }) {
    return (target: any /* future typeof Model */, key) => {
        if (!target.constructor.properties) {
            target.constructor.properties = []
        }

        if (settings?.primary) {
            target.constructor.primaryKey = key;
        }

        if (settings?.relation) {
            if (settings.relation.foreignKey && settings.relation.foreignKey != key) {
                throw new Error("Cannot set relation when foreign key is already in use for " + settings.relation.foreignKey)
            }
            settings.relation.foreignKey = key

            if (!target.constructor.relations) {
                target.constructor.relations = []
            }

            target.constructor.relations.push(settings.relation)
        }

        target.constructor.properties.push(key)


        // Override the getter and setter
        Object.defineProperty(target, key, {
            get(this: Model) {
                if (settings?.relation) {
                    if (this.hasRelation(settings?.relation)) {
                        return this[settings?.relation.modelKey].getPrimaryKey()
                    }
                }
                return this["_" + key];
            },
            set(this: Model, val) {
                if (settings?.relation) {
                    if (this.hasRelation(settings?.relation) && this[key] !== val) {
                        console.log(this[settings?.relation.modelKey])
                        throw new Error("You cannot modify foreign key " + settings?.relation.foreignKey + " directly unless the relation is not set or the value is not changed! (setting " + key + " to " + val + ", currently is " + this[key] + ")")
                    }
                }

                if (settings?.primary && (this["_" + key] || this.existsInDatabase)) {
                    throw new Error("You cannot set the primary key of a model once it has been set or has been loaded from the database. This is not supported. Use auto increment values.")
                }
                if (this["_" + key] !== val) {
                    this["_" + key] = val;
                    this.updatedProperties[key] = true;

                    if (target.debug)
                        console.log("Updated property " + key + " to " + this[key]);
                }
            }
        });
    };
}
