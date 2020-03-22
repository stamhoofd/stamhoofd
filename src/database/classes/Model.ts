import { Database } from './Database'
import Stack from '../../debug/Stack'

export class Model {
    primaryKey: string
    properties: string[]
    updatedProperties = {}
    relations: string[] = []
    debug = false

    constructor() {
        // Read values
    }

    /// Load this model from a DB response
    static fromRow<T extends typeof Model>(row: object): InstanceType<T> {
        const model = new this() as InstanceType<T>
        for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
                const value = row[key];

                // todo: check column mapping here!
                model[key] = value;
            }
        }
        model.markSaved()
        return model;
    }

    private markSaved() {
        this.updatedProperties = {};
    }

    async save(): Promise<void> {
        if (!this.primaryKey) {
            throw new Error("Primary key not set for model " + this.constructor.name);
        }

        const id = this[this.primaryKey]
        if (!id) {
            if (this.debug)
                console.log(`Creating new ${this.constructor.name}`);

            // Check if all properties are defined and if they are present in updatedProperties
            this.properties.forEach(key => {
                if (this[key] === undefined) {
                    throw new Error("Tried to save model " + this.constructor.name + " without defining required property " + key)
                }

                if (!this.updatedProperties[key]) {
                    throw new Error("Tried to save model " + this.constructor.name + " without updating property " + key)
                }
            });
        } else {
            if (this.debug)
                console.log(`Updating ${this.constructor.name} where ${this.primaryKey} = ${id}`);

            // Only check if all updated properties are defined
        }

        const set = {}

        for (const key in this.updatedProperties) {
            if (this.debug)
                console.log("Saved property " + key + " to " + this[key]);
            set[key] = this[key];

            if (set[key] === undefined) {
                throw new Error("Tried to update model " + this.constructor.name + " with undefined property " + key)
            }
        }

        if (Object.keys(this.updatedProperties).length == 0) {
            throw new Error("Tried to update model without any properties modified")
        }


        // todo: save here
        if (!id) {
            const [result] = await Database.insert("insert into `members` SET ?", [set])
            this[this.primaryKey] = result.insertId
            if (this.debug)
                console.log(`New id = ${this[this.primaryKey]}`);
        } else {
            const [result] = await Database.update("update `members` SET ? where `" + this.primaryKey + "` = ?", [set, id])
            if (result.changedRows != 1) {
                console.log('test')
                try {
                    console.log(Stack.parentFile)
                    console.warn(`Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists. At ${Stack.parentFile}:${Stack.parentLine}`)
                    console.log('test')
                } catch (e) {
                    console.error(e)
                }

            }
        }

        // Relations

        // Next
        for (const key in this.updatedProperties) {
            if (this.debug)
                console.log("Saved property " + key + " to " + this[key]);
        }


        // Mark everything as saved
        this.markSaved()
    }
}