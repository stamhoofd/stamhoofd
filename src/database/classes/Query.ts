import { Database } from './Database';
import { Model } from './Model';
import { ToOneRelation } from './ToOneRelation';

type Types = "select" | "update"
export type Where = { key: string; value: any; type?: string }

export class Query<T extends typeof Model> {
    type: Types = "select"
    table: string; // trusted
    select: string[] | null = null // trusted
    _where: Where[] | null = null
    _with: ToOneRelation<string, typeof Model>[] | null = null

    cast: T | undefined;

    constructor(type: Types, table: string, cast?: T) {
        this.type = type
        this.table = table
        this.cast = cast
    }

    as<B extends typeof Model>(cast: B) {
        const query = new Query<B>(this.type, this.table, cast)
        query._where = this._where
        query.select = this.select
        return query
    }

    where(...where: Where[]): this {
        if (!this._where) {
            this._where = where;
            return this
        }
        this._where?.push(...where)
        return this
    }

    /// Join a * to one relation
    // todo: make sure the return type now also contains key Key
    with<Key extends string, M extends typeof Model>(relation: ToOneRelation<Key, M>): this {
        if (!this._with) {
            this._with = [relation];
            return this
        }
        this._with?.push(relation)
        return this
    }

    build(): [string, any] {
        let query = ""
        const values: any[] = []

        switch (this.type) {
            case "select":
                query += "SELECT " + (this.select ? "`" + this.select.join("`, `") + "`" : "*") + " FROM `" + this.table + "` as `this`"
                break;
            default:
                throw new Error("Type " + this.type + " not supported yet");

        }

        // Join
        if (this._with) {
            query += "\nLEFT JOIN";
            this._with.forEach(w => {
                query += `\n\`${w.model.table}\` as \`${w.modelKey}\` ON \`${w.modelKey}\`.\`${w.model.primaryKey}\` = \`this\`.\`${w.foreignKey}\``;
            })
        }

        if (this._where) {
            query += "\nWHERE";
            this._where.forEach(w => {
                query += " `this`.`" + w.key + "` " + (w.type || "=") + " ?";
                values.push(w.value)
            })
        }

        console.log(query, values)

        return [query, values]
    }

    async get(): Promise<InstanceType<T>[]> {
        const [results] = await Database.select(...this.build())

        console.log(results)
        if (this.cast) {
            const cast = this.cast
            return results.map(row => {
                const model = cast.fromRow(row["this"])
                if (this._with) {
                    this._with.forEach(w => {
                        // Check if relation has been loaded
                        if (row[w.modelKey][w.model.primaryKey] !== null) {
                            model[w.modelKey] = w.model.fromRow(row[w.modelKey])
                        } else {
                            console.log("Relation " + w.modelKey + " not set")

                            // Mark the relation as loaded (by setting it to null, since it is an optional relation)
                            // undefined = not loaded, null = loaded but not set
                            model[w.modelKey] = null;
                        }
                    });
                }
                return model;
            })
        }
        return results
    }
}