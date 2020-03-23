import { Model } from '../classes/Model';
import { RelationWithForeignKey } from '../classes/ToOneRelation';

export function column<K extends string | never>(settings?: { primary?: boolean; foreignKey?: RelationWithForeignKey<K, any> }) {
    return (target: any /* future typeof Model */, key) => {
        if (!target.constructor.properties) {
            target.constructor.properties = []
        }

        if (settings?.primary) {
            target.constructor.primaryKey = key;
        }

        if (settings?.foreignKey) {
            settings.foreignKey.prepare?.(target, key);

            if (!target.constructor.relations) {
                target.constructor.relations = []
            }

            target.constructor.relations.push(settings.foreignKey)
        }

        target.constructor.properties.push(key)


        // Override the getter and setter
        Object.defineProperty(target, key, {
            get(this: Model) {
                if (settings?.foreignKey) {
                    if (this.hasRelation(settings?.foreignKey)) {
                        return this[settings?.foreignKey.modelKey].getPrimaryKey()
                    }
                }
                return this["_" + key];
            },
            set(this: Model, val) {
                if (settings?.foreignKey) {
                    if (this.hasRelation(settings?.foreignKey) && this[key] !== val) {
                        console.log(this[settings?.foreignKey.modelKey])
                        throw new Error("You cannot modify foreign key " + settings?.foreignKey.foreignKey + " directly unless the relation is not set or the value is not changed! (setting " + key + " to " + val + ", currently is " + this[key] + ")")
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
