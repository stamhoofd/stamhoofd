import { Database } from './Database'

export class Model {
    primaryKey: string
    properties: string[]
    updatedProperties = {}
    relations: string[] = []

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

    async save() {
        // Check if all properties are defiend
        this.properties.forEach(key => {
            if (this[key] === undefined) {
                throw new Error("Tried to save model " + this.constructor.name + " without defining required property " + key)
            }
        });

        if (!this.primaryKey) {
            throw new Error("Primary key not set for model " + this.constructor.name);
        }

        const id = this[this.primaryKey]
        if (!id) {
            console.log(`Creating new ${this.constructor.name}`);
        } else {
            console.log(`Updating ${this.constructor.name} where ${this.primaryKey} = ${id}`);
        }

        const set = {}

        for (const key in this.updatedProperties) {
            console.log("Saved property " + key + " to " + this[key]);
            set[key] = this[key];
        }


        // todo: save here
        if (!id) {
            const [result] = await Database.insert("insert into `members` SET ?", [set])
            this[this.primaryKey] = result.insertId
            console.log(`New id = ${this[this.primaryKey]}`);
        } else {
            const [result] = await Database.update("update `members` SET ? where `" + this.primaryKey + "` = ?", [set, id])
            if (result.changedRows != 1) {
                console.warn(`Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists.`)
            }
        }

        // Relations

        // Next
        for (const key in this.updatedProperties) {
            console.log("Saved property " + key + " to " + this[key]);
        }


        // Mark everything as saved
        this.markSaved()
    }
}