import { Database } from './Database'
import Stack from '../../debug/Stack'
import { Query, Where, RowInitiable } from './Query'
import { Relation, ToOneRelation } from './Relation'

export class Model /* static implements RowInitiable<Model> */ {
    static primaryKey: string

    /**
     * Properties that are stored in the table (including foreign keys, but without mapped relations!)
     */
    static properties: string[]
    static debug = true
    static table: string // override this!
    static relations: ToOneRelation<string, Model, any>[]

    existsInDatabase = false
    updatedProperties = {}

    constructor() {
        // Read values
        if (!this.static.relations) {
            this.static.relations = []
        }
    }

    /**
     * 
     * @param relation name of the relation you want to load
     * @param sameFetch Whether you also want to load this relation on other models that were fetched from the database in the same query as the current model
     */
    isLoaded<Key extends string, T>(relation: Relation<Key, this, T>): this is (this & Record<Key, T>) {
        return (this as any)[relation.modelKey] !== undefined
    }

    /**
     * Same as isLoaded, but also requires the relation to be already set and not equal null
     */
    hasRelation<Key extends string, T>(relation: Relation<Key, this, T>): this is (this & Record<Key, NonNullable<T>>) {
        return (this as any)[relation.modelKey] !== undefined && (this as any)[relation.modelKey] !== null
    }

    setRelation<Key extends string, T, V extends T>(relation: Relation<Key, this, T>, value: V): this & Record<Key, V> {
        (this as any)[relation.modelKey] = value
        // Maybe also set the foreign key?
        return this as any
    }

    /// Load this model from a DB response (it is possible to not load all fields)
    fromRow(row: any): this {
        this.static.properties.forEach(key => {
            if (row[key] !== undefined) {
                const value = row[key];

                // todo: check column name mapping here
                this[key] = value;
            }
        })

        this.markSaved()
        return this;
    }

    private markSaved() {
        this.updatedProperties = {};
        this.existsInDatabase = true
    }

    static where<T extends typeof Model>(this: T, ...where: Where[]): Query<InstanceType<T>> {
        return new Query("select", this.table, this as any as RowInitiable<InstanceType<T>>).where(...where)
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
            if (this.hasRelation(relation) && !this.updatedProperties[relation.foreignKey]) {
                if (this[relation.modelKey]) {
                    const model = this[relation.modelKey]
                    if (model.getPrimaryKey() !== this["_" + relation.foreignKey] as number) {
                        this.updatedProperties[relation.foreignKey] = this[relation.foreignKey]
                    }
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