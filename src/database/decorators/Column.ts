import { Model } from "../classes/Model"

export function column(settings?: { primary: boolean }) {
    return (target: Model, key) => {
        if (!target.properties) {
            target.properties = []
        }

        if (settings?.primary) {
            target.primaryKey = key;
        }

        target.properties.push(key)

        target["_" + key] = target[key];

        // Override the getter and setter
        Object.defineProperty(target, key, {
            get() {
                return target["_" + key];
            },
            set(val) {
                if (target["_" + key] !== val) {
                    target["_" + key] = val;
                    this.updatedProperties[key] = true;

                    if (target.debug)
                        console.log("Updated property " + key + " to " + this[key]);
                }
            }
        });
    };
}
