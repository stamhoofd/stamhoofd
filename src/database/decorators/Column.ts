import { Model } from '../classes/Model';

export function column(settings?: { primary: boolean }) {
    return (target: any /* future typeof Model */, key) => {
        if (!target.constructor.properties) {
            target.constructor.properties = []
        }

        if (settings?.primary) {
            target.constructor.primaryKey = key;
        }

        target.constructor.properties.push(key)


        // Override the getter and setter
        Object.defineProperty(target, key, {
            get() {
                return this["_" + key];
            },
            set(this: Model, val) {
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
