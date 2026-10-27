/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Column } from './Column.js';
import { Database } from './Database.js';
import type {DatabaseStoredValue} from './DatabaseStoredValue.js';
import type {ManyToManyRelation} from './ManyToManyRelation.js';
import type {ManyToOneRelation} from './ManyToOneRelation.js';
import type {OneToManyRelation} from './OneToManyRelation.js';

type SQLWhere = { sign: string; value: string | Date | number | null | (string | null)[] | (number | null)[]; mode?: string };
type SQLWhereQuery = { [key: string]: string | Date | number | null | SQLWhere | SQLWhere[] };

type Listener<Value> = (value: Value) => Promise<void> | void;

/**
 * Controls the fetching and decrypting of members
 */
export class ModelEventBus<Value> {
    protected listeners: Map<any, { listener: Listener<Value> }[]> = new Map();

    addListener(owner: any, listener: Listener<Value>) {
        const existing = this.listeners.get(owner);
        if (existing) {
            existing.push({ listener });
        }
        else {
            this.listeners.set(owner, [{ listener }]);
        }
    }

    removeListener(owner: any) {
        this.listeners.delete(owner);
    }

    async sendEvent(value: Value) {
        const values: (Promise<void>)[] = [];
        for (const owner of this.listeners.values()) {
            for (const listener of owner) {
                const v = listener.listener(value);
                if (v) {
                    values.push(v);
                }
            }
        }
        return await Promise.all(values);
    }
}

export type ModelEventType = 'created' | 'updated' | 'deleted';

export type ModelEvent<M extends Model = Model> = {
    type: 'created';
    model: M;
} | {
    type: 'updated';
    model: M;
    changedFields: Record<string, DatabaseStoredValue>;
    originalFields: Record<string, DatabaseStoredValue>;

    /**
     * Use this method to compare changes
     */
    getOldModel(): M;
} | {
    type: 'deleted';
    model: M;
};

export class Model /* static implements RowInitiable<Model> */ {
    static primary: Column;
    static modelEventBus = new ModelEventBus<ModelEvent>();

    /**
     * Properties that are stored in the table (including foreign keys, but without mapped relations!)
     */
    static columns: Map<string, Column>;
    static debug = false;
    static showWarnings = false;
    static table: string; // override this!
    static relations: ManyToOneRelation<string, Model>[];

    existsInDatabase = false;

    savedProperties = new Map<string, DatabaseStoredValue | ({
        to: () => DatabaseStoredValue;
        from: () => unknown;
    })>();

    /**
     * Sometimes we have skipUpdate properties that still should get saved on specific occasions.
     * E.g. update updatedAt field manually if is the only changed field.
     */
    forceSaveProperties = new Set<string>();

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
            throw new Error('Unknown property ' + key);
        }
        delete this[key];
        this.savedProperties.delete(key);
    }

    /**
     * Make sure this key will get saved on the next save, even when it is not changed or when it is skipUpdate
     */
    forceSaveProperty(key: string) {
        this.forceSaveProperties.add(key);
    }

    /**
     * Mark all properties as changed, so they will get updated on the next save
     */
    markAllChanged() {
        this.savedProperties.clear();
    }

    /**
     * Returns the default select to select the needed properties of this table
     * @param namespace: optional namespace of this select
     */
    static getDefaultSelect(namespace: string = this.table): string {
        return '`' + namespace + '`.*';
    }

    static selectColumnsWithout(namespace: string = this.table, ...exclude: string[]): string {
        const properties = Array.from(this.columns.keys()).flatMap(name => (exclude.includes(name) ? [] : [name]));

        if (properties.length === 0) {
            // todo: check what to do in this case.
            throw new Error('Not implemented yet');
        }
        return '`' + namespace + '`.`' + properties.join('`, `' + namespace + '`.`') + '`';
    }

    /**
     * Set a relation to undefined, marking it as not loaded (so it won't get saved in the next save)
     * @param relation
     */
    unloadRelation<Key extends keyof any, Value extends Model>(
        this: this & Record<Key, Value>,
        relation: ManyToOneRelation<Key, any>,
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
        relation: ManyToOneRelation<Key, any>,
    ): this & Record<Key, null> {
        // Todo: check if relation is nullable?
        return this.setOptionalRelation(relation, null);
    }

    setOptionalRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToOneRelation<Key, Value>,
        value: Value | null,
    ): this & Record<Key, Value | null> {
        // Todo: check if relation is nullable?

        if (value !== null && !value.existsInDatabase) {
            throw new Error('You cannot set a relation to a model that are not yet saved in the database.');
        }
        const t = this as any;
        t[relation.modelKey] = value;
        t[relation.foreignKey] = value ? value.getPrimaryKey() : null;
        return t;
    }

    setRelation<Key extends keyof any, Value extends Model, V extends Value>(relation: ManyToOneRelation<Key, Value>, value: V): this & Record<Key, V> {
        if (!value.existsInDatabase) {
            throw new Error('You cannot set a relation to a model that are not yet saved in the database.');
        }
        const t = this as any;
        t[relation.modelKey] = value;
        t[relation.foreignKey] = value.getPrimaryKey();
        return t;
    }

    /**
     * Set a many relation. Note that this doesn't save the relation! You'll need to use the methods of the relation instead
     */
    setManyRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToManyRelation<Key, any, Value, any> | OneToManyRelation<Key, any, Value>,
        value: Value[],
    ): this & Record<Key, Value[]> {
        value.forEach((v) => {
            if (!v.existsInDatabase) {
                throw new Error('You cannot set a relation to models that are not yet saved in the database.');
            }
        });
        const t = this as any;
        t[relation.modelKey] = value;
        return t;
    }

    /**
     * Set a many relation. Note that this doesn't save the relation! You'll need to use the methods of the relation instead
     */
    getManyRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToManyRelation<Key, any, Value, any> | OneToManyRelation<Key, any, Value>,
    ): Value[] | null {
        const t = this as any;
        return t[relation.modelKey] ?? null;
    }

    /**
     * Load the returned properties from a DB response row into the model
     * If the row's primary key is null, undefined is returned
     */
    static fromRow<T extends typeof Model>(this: T, row: Record<string, DatabaseStoredValue>): InstanceType<T> | undefined {
        if (row === undefined || (this.primary && (row[this.primary.name] === null || row[this.primary.name] === undefined))) {
            return undefined;
        }

        const model = new this() as InstanceType<T>;
        for (const column of this.columns.values()) {
            if (row[column.name] !== undefined) {
                const value = column.from(row[column.name]);
                model[column.name] = value;
            }
            else {
                // Override default value to prevent any saving!
                model[column.name] = undefined;
            }
        }

        model.markSaved(row, { fromMySQL: true }); // note: we don't pass row because that value is unreliable for json values (mysql performs sorting and other opertions on keys)
        return model;
    }

    static fromRows<T extends typeof Model>(this: T, rows: Record<string, Record<string, DatabaseStoredValue>>[], namespace: string): InstanceType<T>[] {
        return rows.flatMap((row) => {
            const model = this.fromRow(row[namespace]);
            if (model) {
                return [model];
            }
            return [];
        });
    }

    markSaved(fields?: Record<string, DatabaseStoredValue>, options?: { fromMySQL?: boolean }) {
        this.existsInDatabase = true;
        this.forceSaveProperties.clear();

        for (const column of this.static.columns.values()) {
            if ((fields ? fields[column.name] : this[column.name]) !== undefined) {
                // If undefined: do not update, since we didn't save the value
                this.savedProperties.set(column.name, fields
                    ? (column.type === 'json' && options?.fromMySQL
                            ? {
                                // We can never use the original value we received from MySQL because the ordering of keys is different in MySQL.
                                // We use this object to avoid doing expensive CPU operations if we don't need to check if a value has changed
                                // so we only evaluate this once we actually try to save a model to the database
                                    to() {
                                        if (this._to) {
                                            return this._to;
                                        }
                                        const value = this._from ?? column.from(fields[column.name]);
                                        this._from = value;

                                        const found = column.to(value);
                                        // Store permanently
                                        this._to = found;
                                        return found;
                                    },
                                    from() {
                                        if (this._from) {
                                            return this._from;
                                        }
                                        const from = column.from(fields[column.name]);
                                        this._from = from;
                                        return from;
                                    },
                                }
                            : fields[column.name]
                        )
                    : column.to(this[column.name]),
                );
            }
        }

        /// Save relation foreign keys (so we can check if the id has changed)
        for (const relation of this.static.relations) {
            if (relation.isLoaded(this)) {
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey];
                    this[relation.foreignKey] = model.getPrimaryKey();
                }
                else {
                    this[relation.foreignKey] = null;
                }
            }
        }
    }

    copyFrom<T extends Model>(this: T, from: T) {
        for (const column of this.static.columns.values()) {
            this[column.name] = from[column.name];
        }

        // Unload all relations
        for (const relation of this.static.relations) {
            if (relation.isLoaded(this)) {
                this[relation.modelKey] = undefined;
            }
        }

        this.savedProperties = from.savedProperties;
        this.forceSaveProperties = from.forceSaveProperties;
        this.existsInDatabase = from.existsInDatabase;
    }

    get static(): typeof Model {
        return this.constructor as typeof Model;
    }

    getPrimaryKey(): number | string | null {
        return this[this.static.primary.name];
    }

    /**
     * Get a model by its primary key
     * @param id primary key
     */
    static async getByID<T extends typeof Model>(this: T, id: number | string): Promise<InstanceType<T> | undefined> {
        const [rows] = await Database.select(`SELECT ${this.getDefaultSelect()} FROM \`${this.table}\` WHERE \`${this.primary.name}\` = ? LIMIT 1`, [id]);

        if (rows.length === 0) {
            return undefined;
        }

        // Read member + address from first row
        const row = rows[0][this.table];
        return this.fromRow(row);
    }

    /**
     * Get multiple models by their ID
     * @param ids primary key of the models you want to fetch
     */
    static async getByIDs<T extends typeof Model>(this: T, ...ids: (number | string)[]): Promise<InstanceType<T>[]> {
        if (ids.length === 0) {
            return [];
        }
        const [rows] = await Database.select(`SELECT ${this.getDefaultSelect()} FROM \`${this.table}\` WHERE \`${this.primary.name}\` IN (?) LIMIT ?`, [
            ids,
            ids.length,
        ]);

        // Read member + address from first row
        return this.fromRows(rows, this.table);
    }

    static buildWhereOperator(key: string, value: SQLWhere): [string, any[]] {
        let whereQuery: string;
        const params: any[] = [];

        switch (value.sign) {
            case 'MATCH': {
                let suffix = '';
                if (value.mode) {
                    switch (value.mode) {
                        case 'BOOLEAN':
                            suffix = ' IN BOOLEAN MODE';
                            break;
                        default:
                            throw new Error('Unknown match mode ' + value.mode);
                    }
                }
                whereQuery = (`MATCH(\`${this.table}\`.\`${key}\`) AGAINST(?${suffix})`);
                params.push(value.value);
                break;
            }

            case 'LIKE':
                whereQuery = (`\`${this.table}\`.\`${key}\` LIKE ?`);
                params.push(value.value);
                break;

            case '!=':
                if (value.value === null) {
                    whereQuery = (`\`${this.table}\`.\`${key}\` IS NOT NULL`);
                }
                else {
                    whereQuery = (`\`${this.table}\`.\`${key}\` != ?`);
                    params.push(value.value);
                }
                break;

            case '<':
                whereQuery = (`\`${this.table}\`.\`${key}\` < ?`);
                params.push(value.value);
                break;

            case '>':
                whereQuery = (`\`${this.table}\`.\`${key}\` > ?`);
                params.push(value.value);
                break;

            case '<=':
                whereQuery = (`\`${this.table}\`.\`${key}\` <= ?`);
                params.push(value.value);
                break;

            case '>=':
                whereQuery = (`\`${this.table}\`.\`${key}\` >= ?`);
                params.push(value.value);
                break;

            case '=':
                if (value.value === null) {
                    whereQuery = (`\`${this.table}\`.\`${key}\` IS NULL`);
                }
                else {
                    whereQuery = (`\`${this.table}\`.\`${key}\` = ?`);
                    params.push(value.value);
                }
                break;

            case 'IN':
                if (!Array.isArray(value.value)) {
                    throw new Error('Expected an array for IN where query');
                }
                if (value.value.includes(null)) {
                    const filtered = (value.value as (string | number | null)[]).filter(v => v !== null);
                    if (filtered.length === 0) {
                        whereQuery = (`\`${this.table}\`.\`${key}\` IS NULL`);
                    }
                    else if (filtered.length === 1) {
                        // Special query
                        whereQuery = (`(\`${this.table}\`.\`${key}\` = ? OR \`${this.table}\`.\`${key}\` IS NULL)`);
                        params.push(filtered[0]);
                    }
                    else {
                        // Special query
                        whereQuery = (`(\`${this.table}\`.\`${key}\` IN (?) OR \`${this.table}\`.\`${key}\` IS NULL)`);
                        params.push(filtered);
                    }
                }
                else {
                    whereQuery = (`\`${this.table}\`.\`${key}\` IN (?)`);
                    params.push(value.value);
                }

                break;

            default:
                throw new Error('Sign not supported.');
        }

        return [whereQuery, params];
    }

    static buildWhereQuery(where: SQLWhereQuery): [string, any[]] {
        const whereQuery: string[] = [];
        const params: any[] = [];

        for (const key in where) {
            if (Object.hasOwnProperty.call(where, key)) {
                const value = where[key];
                if (Array.isArray(value)) {
                    for (const v of value) {
                        const [w, p] = this.buildWhereOperator(key, v);
                        whereQuery.push(w);
                        params.push(...p);
                    }
                }
                else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                    const [w, p] = this.buildWhereOperator(key, value);
                    whereQuery.push(w);
                    params.push(...p);
                }
                else {
                    if (value === null) {
                        whereQuery.push(`\`${this.table}\`.\`${key}\` IS NULL`);
                    }
                    else {
                        whereQuery.push(`\`${this.table}\`.\`${key}\` = ?`);
                        params.push(value);
                    }
                }
            }
        }

        return [whereQuery.join(' AND '), params];
    }

    /**
     * @deprecated Use the new SQL package instead
     * Get multiple models by a simple where
     */
    static async where<T extends typeof Model>(this: T, where: SQLWhereQuery, extra?: {
        limit?: number;
        sort?: (string | { column: string | SQLWhereQuery; direction?: 'ASC' | 'DESC' })[];
        select?: string;
    }): Promise<InstanceType<T>[]> {
        const params: any[] = [];

        let query = `SELECT ${extra?.select ?? this.getDefaultSelect()} FROM \`${this.table}\``;
        if (Object.keys(where).length !== 0) {
            const [whereQuery, p] = this.buildWhereQuery(where);
            query += `WHERE ` + whereQuery;
            params.push(...p);
        }

        if (extra && extra.sort !== undefined) {
            const sortQuery: string[] = [];

            for (const item of extra.sort) {
                if (typeof item === 'string') {
                    sortQuery.push(Database.escapeId(item) + ' ASC');
                }
                else if (typeof item.column === 'string') {
                    sortQuery.push(Database.escapeId(item.column) + ' ' + (item.direction ?? 'ASC'));
                }
                else {
                    // Repeat use of a where query in the sorting (needed when fulltext searching and need to sort on the score, because limit won't work without this for an unknown reason)
                    const [w, p] = this.buildWhereQuery(item.column);

                    sortQuery.push('(' + w + ') ' + (item.direction ?? 'ASC'));
                    params.push(...p);
                }
            }

            query += ` ORDER BY ` + sortQuery.join(', ');
        }

        if (extra && extra.limit !== undefined) {
            query += ` LIMIT ?`;
            params.push(extra.limit);
        }

        const [rows] = await Database.select(query, params);

        return this.fromRows(rows, this.table);
    }

    /**
     * Get multiple models by a simple where
     */
    static async all<T extends typeof Model>(this: T, limit?: number): Promise<InstanceType<T>[]> {
        const params: any[] = [];
        let query = `SELECT ${this.getDefaultSelect()} FROM \`${this.table}\``;

        if (limit) {
            query += ` LIMIT ?`;
            params.push(limit);
        }

        const [rows] = await Database.select(query, params);
        return this.fromRows(rows, this.table);
    }

    /**
     * Return an object of all the properties that are changed and their database representation
     */
    getChangedDatabaseProperties(): { fields: Record<string, DatabaseStoredValue>; skipUpdate: number } {
        const set: Record<string, DatabaseStoredValue> = {};
        let skipUpdate = 0;

        for (const column of this.static.columns.values()) {
            if (column.primary && column.type === 'integer' && this.static.primary.name === 'id') {
                // Auto increment: not allowed to set
                continue;
            }

            if (!this.existsInDatabase && this[column.name] === undefined) {
                // In the future we might make some columns optional because they have a default value in the database.
                // But that could cause inconsitent state, so it would be better to generate default values in code.
                throw new Error('Tried to create model ' + this.constructor.name + ' with undefined property ' + column.name);
            }

            if (this[column.name] !== undefined) {
                const forceSave = this.forceSaveProperties.has(column.name);
                const oldSavedValue = forceSave ? undefined : this.savedProperties.get(column.name);
                const saveValue = forceSave ? null : column.to(this[column.name]); // .to is expensive, so avoid calling it when not needed
                if (forceSave || oldSavedValue === undefined || column.isChanged(typeof oldSavedValue === 'object' && oldSavedValue !== null && 'to' in oldSavedValue ? oldSavedValue.to() : oldSavedValue, saveValue)) {
                    set[column.name] = forceSave ? column.to(this[column.name]) : saveValue;

                    if (column.skipUpdate && !forceSave) {
                        skipUpdate++;
                    }
                }
            }
        }

        return { fields: set, skipUpdate };
    }

    beforeSave() {
        for (const column of this.static.columns.values()) {
            // Run beforeSave
            if (column.beforeSave) {
                this[column.name] = column.beforeSave.call(this, this[column.name]);
            }
        }
    }

    /**
     * Return original value from the database or undefined if not known
     */
    getOriginalValue(key: string): unknown | undefined {
        const column = this.static.columns.get(key);
        if (!column) {
            throw new Error('Unknown property ' + key);
        }
        const c = this.savedProperties.get(key);
        if (c === undefined) {
            return undefined;
        }
        if (typeof c === 'object' && c !== null && 'from' in c) {
            return c.from();
        }
        return column.from(c);
    }

    /**
     * Inserts a new row or updates changed columns after beforeSave transforms.
     * Returns false if nothing needs writing, including updates with only skipUpdate changes.
     * By default records the saved values and emits a created/updated event.
     * Loaded relations must reference saved models and agree with their foreign keys.
     */
    async save(options?: {skipMarkSaved?: boolean, skipSendEvents?: boolean}): Promise<boolean> {
        if (!this.static.table) {
            throw new Error('Table name not set');
        }

        if (!this.static.primary) {
            throw new Error('Primary key not set for model ' + this.constructor.name + ' ' + this.static);
        }

        // Check if relation models were modified
        for (const relation of this.static.relations) {
            // If a relation is loaded, we can check if it changed the value of the foreign key
            if (relation.isLoaded(this)) {
                // The foreign key is modified (set, changed or cleared)
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey] as Model;

                    if (!model.existsInDatabase) {
                        throw new Error('You cannot set a relation that is not yet saved in the database.');
                    }

                    if (this[relation.foreignKey] !== model.getPrimaryKey()) {
                        // Should always match because setRelation will make it match on setting it.
                        throw new Error(
                            'You cannot modify the value of a foreign key when the relation is loaded. Unload the relation first or modify the relation with setRelation',
                        );
                    }
                }
                else {
                    if (this[relation.foreignKey] !== null) {
                        // Should always match because setRelation will make it match on setting it.
                        throw new Error(
                            'You cannot set a foreign key when the relation is loaded. Unload the relation first or modify the relation with setRelation',
                        );
                    }
                }
            }
        }

        const id = this.getPrimaryKey();
        if (!id) {
            if (this.existsInDatabase) {
                throw new Error('Model ' + this.constructor.name + " was loaded from the Database, but didn't select the ID. Saving not possible.");
            }
        }
        else {
            if (!this.existsInDatabase && this.static.primary.type === 'integer' && this.static.primary.name === 'id') {
                throw new Error(
                    `PrimaryKey was set programmatically without fetching the model ${this.constructor.name} from the database. This is not allowed for integer primary keys.`,
                );
            }
        }

        this.beforeSave();
        const { fields, skipUpdate } = this.getChangedDatabaseProperties();

        if (Object.keys(fields).length === 0) {
            if (Model.showWarnings) console.warn('Tried to update model without any properties modified');
            return false;
        }

        if (this.existsInDatabase && skipUpdate === Object.keys(fields).length) {
            if (Model.showWarnings) console.warn('Tried to update model without any properties modified');
            return false;
        }

        if (Model.debug) console.log('Saving ' + this.constructor.name + ' to...', fields);

        // todo: save here
        if (!this.existsInDatabase) {
            if (Model.debug) console.log(`Creating new ${this.constructor.name}`);

            const [result] = await Database.insert('INSERT INTO `' + this.static.table + '` SET ?', [fields]);

            if (this.static.primary.type === 'integer' && this.static.primary.name === 'id') {
                // Auto increment value
                this[this.static.primary.name] = result.insertId;
                fields[this.static.primary.name] = result.insertId; // Also mark saved
                if (Model.debug) console.log(`New id = ${this[this.static.primary.name]}`);
            }
        }
        else {
            if (Model.debug) console.log(`Updating ${this.constructor.name} where ${this.static.primary.name} = ${id}`);

            const [result] = await Database.update('UPDATE `' + this.static.table + '` SET ? WHERE `' + this.static.primary.name + '` = ?', [fields, id]);
            if (result.changedRows !== 1 && Model.showWarnings) {
                console.warn(`Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists.`);
            }
        }

        // Emit event
        if (this.existsInDatabase) {
            // Keep reference to old properties before marking saved
            let originalProperties:  {
                [k: string]: DatabaseStoredValue;
            };
            if (!options?.skipSendEvents) {
                originalProperties = Object.fromEntries(
                    Array.from(this.savedProperties.entries()).map(([key, value]) => {
                        if (typeof value === 'object' && value !== null && 'to' in value) {
                            return [key, value.to()];
                        }
                        return [key, value];
                    }),
                );
            }

            // Mark saved before sending the event

            if (!options?.skipMarkSaved) {
                this.markSaved(fields);
            }

            if (!options?.skipSendEvents) {
                await this.static.modelEventBus.sendEvent({
                    type: 'updated',
                    model: this,
                    changedFields: fields,
                    originalFields: originalProperties!,
                    getOldModel: () => {
                        // Build a new model as if it was loaded from the database using the same original properties
                        const v = this.static.fromRow(originalProperties);
                        if (v === undefined) {
                            throw new Error('Failed to create old model: primary key might be missing');
                        }
                        return v;
                    },
                });
            }
        }
        else {
            if (!options?.skipMarkSaved) {
                this.markSaved(fields);
            }
            if (!options?.skipSendEvents) {
                await this.static.modelEventBus.sendEvent({ type: 'created', model: this });
            }
        }

        return true;
    }

    /** Deletes this saved row by primary key, clears saved state and emits a deleted event; throws for unsaved models. */
    async delete() {
        const id = this.getPrimaryKey();

        if (!id && this.existsInDatabase) {
            throw new Error('Model ' + this.constructor.name + " was loaded from the Database, but didn't select the ID. Deleting not possible.");
        }

        if (!id || !this.existsInDatabase) {
            throw new Error('Model ' + this.constructor.name + " can't be deleted if it doesn't exist in the database already");
        }

        if (Model.debug) console.log(`Deleting ${this.constructor.name} where ${this.static.primary.name} = ${id}`);

        const [result] = await Database.delete('DELETE FROM `' + this.static.table + '` WHERE `' + this.static.primary.name + '` = ?', [id]);
        if (result.affectedRows !== 1 && Model.showWarnings) {
            console.warn(`Deleted ${this.constructor.name}, but it didn't change a row. Check if ID exists.`);
        }

        this.existsInDatabase = false;
        if (this.static.primary.type === 'integer' && this.static.primary.name === 'id') {
            this.eraseProperty(this.static.primary.name);
        }
        this.savedProperties.clear();

        await this.static.modelEventBus.sendEvent({ type: 'deleted', model: this });
    }
}
