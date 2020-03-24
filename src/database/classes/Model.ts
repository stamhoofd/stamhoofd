import { Database } from './Database'
import Stack from '../../debug/Stack'
import { ManyToOneRelation } from './ManyToOneRelation'

export class Model /* static implements RowInitiable<Model> */ {
    static primaryKey: string

    /**
     * Properties that are stored in the table (including foreign keys, but without mapped relations!)
     */
    static properties: string[]
    static debug = true
    static table: string // override this!
    static relations: ManyToOneRelation[]

    existsInDatabase = false
    updatedProperties = {}

    constructor() {
        // Read values
        if (!this.static.relations) {
            this.static.relations = []
        }
    }

    setRelation<Name extends keyof any, Value>(name: Name, value: Value): this & Record<Name, Value> {
        const t = this as any
        t[name] = value
        return t
    }

    /// Load this model from a DB response (it is possible to not load all fields)
    static fromRow<T extends typeof Model>(this: T, row: any): InstanceType<T> {
        const model = new this() as InstanceType<T>
        this.properties.forEach(key => {
            if (row[key] !== undefined) {
                const value = row[key];

                // todo: check column name mapping here
                model[key] = value;
            }
        })

        model.markSaved()
        return model;
    }

    private markSaved() {
        this.updatedProperties = {};
        this.existsInDatabase = true
    }

    get static(): typeof Model {
        return this.constructor as typeof Model;
    }

    getPrimaryKey(): number | null {
        return this[this.static.primaryKey]
    }

    /**
     * 
     * @param force: Save all defined properties, even when no propery is modified. This is enabled by default is the model is not yet inserted in the database yet.
     */
    async save(force = false): Promise<void> {
        if (!this.static.table) {
            throw new Error("Table name not set")
        }
        console.log("Saving to table ", this.static.table)

        if (!this.static.primaryKey) {
            throw new Error("Primary key not set for model " + this.constructor.name + " " + this.static);
        }

        const id = this[this.static.primaryKey]
        if (!id) {
            if (this.existsInDatabase) {
                throw new Error("Model " + this.constructor.name + " was loaded from the Database, but didn't select the ID. Saving not possible.");
            }
            force = true

            if (this.static.debug)
                console.log(`Creating new ${this.constructor.name}`);

            // Check if all properties are defined
            this.static.properties.forEach(key => {
                if (this[key] === undefined) {
                    throw new Error("Tried to save model " + this.constructor.name + " without defining required property " + key)
                }
            });
        } else {
            if (!this.existsInDatabase) {
                throw new Error(`PrimaryKey was set programmatically without fetching the model ${this.constructor.name} from the database`)
            }

            if (this.static.debug)
                console.log(`Updating ${this.constructor.name} where ${this.static.primaryKey} = ${id}`);

            // Only check if all updated properties are defined
        }

        // Check if relation models were modified
        this.static.relations.forEach(relation => {
            if (relation.isLoaded(this) && !this.updatedProperties[relation.foreignKey]) {
                const model = this[relation.modelKey] as Model
                if (model.getPrimaryKey() !== this["_" + relation.foreignKey] as any as number) {
                    this.updatedProperties[relation.foreignKey] = this[relation.foreignKey]
                }
            }
        })

        if (Object.keys(this.updatedProperties).length == 0) {
            if (!force) {
                console.warn("Tried to update model without any properties modified")
                return;
            }
        }

        if (force) {
            /// Mark all properties as updated
            this.static.properties.forEach(key => {
                if (this[key] !== undefined) {
                    this.updatedProperties[key] = true;
                }
            })

            if (Object.keys(this.updatedProperties).length == 0) {
                throw new Error("Nothing to save! All properties are undefined.");
            }
        }

        const set = {}

        for (const key in this.updatedProperties) {

            set[key] = this[key];

            if (set[key] === undefined) {
                console.log(this)
                throw new Error("Tried to update model " + this.constructor.name + " with undefined property " + key)
            }
        }

        if (this.static.debug)
            console.log("Saving " + this.constructor.name + " to...", set);


        // todo: save here
        if (!id) {
            const [result] = await Database.insert("insert into `" + this.static.table + "` SET ?", [set])
            this[this.static.primaryKey] = result.insertId
            if (this.static.debug)
                console.log(`New id = ${this[this.static.primaryKey]}`);
        } else {
            const [result] = await Database.update("update `" + this.static.table + "` SET ? where `" + this.static.primaryKey + "` = ?", [set, id])
            if (result.changedRows != 1) {
                try {
                    console.log(Stack.parentFile)
                    console.warn(`Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists. At ${Stack.parentFile}:${Stack.parentLine}`)
                } catch (e) {
                    console.error(e)
                }

            }
        }

        // Relations

        // Next
        for (const key in this.updatedProperties) {
            if (this.static.debug)
                console.log("Saved property " + key + " to " + this[key]);
        }


        // Mark everything as saved
        this.markSaved()
    }
}