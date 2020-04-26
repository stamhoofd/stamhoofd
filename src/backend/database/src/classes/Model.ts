import { Column } from "./Column";
import { Database } from "./Database";
import { ManyToManyRelation } from "./ManyToManyRelation";
import { ManyToOneRelation } from "./ManyToOneRelation";

export class Model /* static implements RowInitiable<Model> */ {
    static primary: Column;

    /**
     * Properties that are stored in the table (including foreign keys, but without mapped relations!)
     */
    static columns: Map<string, Column>;
    static debug = false;
    static table: string; // override this!
    static relations: ManyToOneRelation<string, Model>[];

    existsInDatabase = false;

    private savedProperties = new Map<string, any>();

    constructor() {
        // Read values
        if (!this.static.relations) {
            this.static.relations = [];
        }

        if (!this.static.columns) {
            this.static.columns = new Map<string, Column>();
        }
    }

    /**
     * Delete the value of a key from memory
     */
    eraseProperty(key: string) {
        const column = this.static.columns.get(key);
        if (!column) {
            throw new Error("Unknown property " + key);
        }
        delete this[key];
        this.savedProperties.delete(key);
    }

    /**
     * Returns the default select to select the needed properties of this table
     * @param namespace: optional namespace of this select
     */
    static getDefaultSelect(namespace: string = this.table): string {
        return "`" + namespace + "`.*";
    }

    static selectColumnsWithout(namespace: string = this.table, ...exclude: string[]): string {
        const properties = Array.from(this.columns.keys()).flatMap((name) => (exclude.includes(name) ? [] : [name]));

        if (properties.length == 0) {
            // todo: check what to do in this case.
            throw new Error("Not implemented yet");
        }
        return "`" + namespace + "`.`" + properties.join("`, `" + namespace + "`.`") + "`";
    }

    /**
     * Set a relation to undefined, marking it as not loaded (so it won't get saved in the next save)
     * @param relation
     */
    unloadRelation<Key extends keyof any, Value extends Model>(
        this: this & Record<Key, Value>,
        relation: ManyToOneRelation<Key, any>
    ): this & Record<Key, undefined> {
        // Todo: check if relation is nullable?
        const t = this as any;
        delete t[relation.modelKey];
        return t;
    }

    /**
     * Set a relation to null, deleting it on the next save (unless unloadRelation is called)
     * @param relation
     */
    unsetRelation<Key extends keyof any, Value extends Model>(
        this: this & Record<Key, Value>,
        relation: ManyToOneRelation<Key, any>
    ): this & Record<Key, null> {
        // Todo: check if relation is nullable?
        return this.setOptionalRelation(relation, null);
    }

    setOptionalRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToOneRelation<Key, Value>,
        value: Value | null
    ): this & Record<Key, Value | null> {
        // Todo: check if relation is nullable?

        if (value !== null && !value.existsInDatabase) {
            throw new Error("You cannot set a relation to a model that are not yet saved in the database.");
        }
        const t = this as any;
        t[relation.modelKey] = value;
        t[relation.foreignKey] = value ? value.getPrimaryKey() : null;
        return t;
    }

    setRelation<Key extends keyof any, Value extends Model, V extends Value>(
        relation: ManyToOneRelation<Key, Value>,
        value: V
    ): this & Record<Key, V> {
        if (!value.existsInDatabase) {
            throw new Error("You cannot set a relation to a model that are not yet saved in the database.");
        }
        const t = this as any;
        t[relation.modelKey] = value;
        t[relation.foreignKey] = value.getPrimaryKey();
        return t;
    }

    setManyRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToManyRelation<Key, any, Value>,
        value: Value[]
    ): this & Record<Key, Value[]> {
        value.forEach((v) => {
            if (!v.existsInDatabase) {
                throw new Error("You cannot set a relation to models that are not yet saved in the database.");
            }
        });
        const t = this as any;
        t[relation.modelKey] = value;
        return t;
    }

    /**
     * Load the returned properties from a DB response row into the model
     * If the row's primary key is null, undefined is returned
     */
    static fromRow<T extends typeof Model>(this: T, row: any): InstanceType<T> | undefined {
        if (row[this.primary.name] === null || row[this.primary.name] === undefined) {
            return undefined;
        }

        const model = new this() as InstanceType<T>;
        for (const column of this.columns.values()) {
            if (row[column.name] !== undefined) {
                const value = column.from(row[column.name]);
                model[column.name] = value;
            }
        }

        model.markSaved();
        return model;
    }

    static fromRows<T extends typeof Model>(this: T, rows: any[], namespace: string): InstanceType<T>[] {
        return rows.flatMap((row) => {
            const model = this.fromRow(row[namespace]);
            if (model) {
                return [model];
            }
            return [];
        });
    }

    private markSaved() {
        this.existsInDatabase = true;

        this.savedProperties.clear();
        for (const column of this.static.columns.values()) {
            if (this[column.name] !== undefined) {
                // If undefined: do not update, since we didn't save the value
                this.savedProperties.set(column.name, column.saveProperty(this[column.name]));
            }
        }

        /// Save relation foreign keys (so we can check if the id has changed)
        for (const relation of this.static.relations) {
            if (relation.isLoaded(this)) {
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey];
                    this[relation.foreignKey] = model.getPrimaryKey();
                } else {
                    this[relation.foreignKey] = null;
                }
            }
        }
    }

    get static(): typeof Model {
        return this.constructor as typeof Model;
    }

    getPrimaryKey(): number | string | null {
        return this[this.static.primary.name];
    }

    async save(): Promise<boolean> {
        if (!this.static.table) {
            throw new Error("Table name not set");
        }

        if (!this.static.primary) {
            throw new Error("Primary key not set for model " + this.constructor.name + " " + this.static);
        }

        // Check if relation models were modified
        for (const relation of this.static.relations) {
            // If a relation is loaded, we can check if it changed the value of the foreign key
            if (relation.isLoaded(this)) {
                // The foreign key is modified (set, changed or cleared)
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey] as Model;

                    if (!model.existsInDatabase) {
                        throw new Error("You cannot set a relation that is not yet saved in the database.");
                    }

                    if (this[relation.foreignKey] !== model.getPrimaryKey()) {
                        // Should always match because setRelation will make it match on setting it.
                        throw new Error(
                            "You cannot modify the value of a foreign key when the relation is loaded. Unload the relation first or modify the relation with setRelation"
                        );
                    }
                } else {
                    if (this[relation.foreignKey] !== null) {
                        // Should always match because setRelation will make it match on setting it.
                        throw new Error(
                            "You cannot set a foreign key when the relation is loaded. Unload the relation first or modify the relation with setRelation"
                        );
                    }
                }
            }
        }

        const id = this.getPrimaryKey();
        if (!id) {
            if (this.existsInDatabase) {
                throw new Error(
                    "Model " +
                    this.constructor.name +
                    " was loaded from the Database, but didn't select the ID. Saving not possible."
                );
            }
        } else {
            if (!this.existsInDatabase && this.static.primary.type == "integer") {
                throw new Error(
                    `PrimaryKey was set programmatically without fetching the model ${this.constructor.name} from the database. This is not allowed for integer primary keys.`
                );
            }
        }

        if (!this.existsInDatabase) {
            const col = this.static.columns.get("createdOn");
            if (col && col.type == "datetime" && this["createdOn"] === undefined) {
                // Set createdOn automatically
                this["createdOn"] = new Date();
                this["createdOn"].setMilliseconds(0);
            }

            // Set updatedOn if not nullable and not yet set
            const up = this.static.columns.get("updatedOn");
            if (up && up.type == "datetime" && !up.nullable && this["updatedOn"] === undefined) {
                // Set updatedOn automatically
                this["updatedOn"] = new Date();
                this["updatedOn"].setMilliseconds(0);
            }
        } else {
            // Only check if all updated properties are defined
            const col = this.static.columns.get("updatedOn");
            if (col && col.type == "datetime") {
                // Set updatedOn automatically
                this["updatedOn"] = new Date();
                this["updatedOn"].setMilliseconds(0);
            }
        }

        const set = {};

        for (const column of this.static.columns.values()) {
            if (column.primary && column.type == "integer") {
                // Auto increment: not allowed to set
                continue;
            }

            if (!this.existsInDatabase && this[column.name] === undefined) {
                // In the future we might make some columns optional because they have a default value in the database.
                // But that could cause inconsitent state, so it would be better to generate default values in code.
                throw new Error(
                    "Tried to create model " + this.constructor.name + " with undefined property " + column.name
                );
            }

            if (
                this[column.name] !== undefined &&
                column.isChanged(this.savedProperties.get(column.name), this[column.name])
            ) {
                set[column.name] = column.to(this[column.name]);
            } else {
                // Check JSON fields. The reference could have stayed the same, but the value might have changed.
            }
        }

        if (Object.keys(set).length == 0) {
            console.warn("Tried to update model without any properties modified");
            return false;
        }

        if (this.static.debug) console.log("Saving " + this.constructor.name + " to...", set);

        // todo: save here
        if (!this.existsInDatabase) {
            if (this.static.debug) console.log(`Creating new ${this.constructor.name}`);

            const [result] = await Database.insert("INSERT INTO `" + this.static.table + "` SET ?", [set]);

            if (this.static.primary.type == "integer") {
                // Auto increment value
                this[this.static.primary.name] = result.insertId;
                if (this.static.debug) console.log(`New id = ${this[this.static.primary.name]}`);
            }
        } else {
            if (this.static.debug)
                console.log(`Updating ${this.constructor.name} where ${this.static.primary.name} = ${id}`);

            const [result] = await Database.update(
                "UPDATE `" + this.static.table + "` SET ? WHERE `" + this.static.primary.name + "` = ?",
                [set, id]
            );
            if (result.changedRows != 1) {
                console.warn(
                    `Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists.`
                );
            }
        }

        // Mark everything as saved
        this.markSaved();
        return true;
    }

    async delete() {
        const id = this.getPrimaryKey();
    
        if (!id && this.existsInDatabase) {
            throw new Error(
                "Model " +
                this.constructor.name +
                " was loaded from the Database, but didn't select the ID. Deleting not possible."
            );
        }

        if (!id || !this.existsInDatabase) {
            throw new Error(
                "Model " +
                this.constructor.name +
                " can't be deleted if it doesn't exist in the database already"
            );
        }

        if (this.static.debug)
            console.log(`Updating ${this.constructor.name} where ${this.static.primary.name} = ${id}`);

        const [result] = await Database.delete(
            "DELETE FROM `" + this.static.table + "` WHERE `" + this.static.primary.name + "` = ?",
            [id]
        );
        if (result.affectedRows != 1) {
            console.warn(
                `Deleted ${this.constructor.name}, but it didn't change a row. Check if ID exists.`
            );
        }

        this.existsInDatabase = false;
        this.eraseProperty(this.static.primary.name);
        this.savedProperties.clear();
    }
}
