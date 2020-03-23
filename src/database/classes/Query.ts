import { Database } from './Database';
import { Model } from './Model';

type Types = "select" | "update"
export type Where = { key: string; value: any; type?: string }

export class Query<T extends typeof Model> {
    type: Types = "select"
    table: string; // trusted
    select: string[] | null = null // trusted
    _where: Where[] | null = null

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

    where(...where: Where[]) {
        if (!this._where) {
            this._where = where;
            return this
        }
        this._where?.push(...where)
        return this
    }

    build(): [string, any] {
        let query = ""
        const values: any[] = []

        switch (this.type) {
            case "select":
                query += "SELECT " + (this.select ? "`" + this.select.join("`, `") + "`" : "*") + " FROM `" + this.table + "`"
                break;
            default:
                throw new Error("Type " + this.type + " not supported yet");

        }

        if (this._where) {
            query += "\nWHERE";
            this._where.forEach(w => {
                query += " `" + w.key + "` " + (w.type || "=") + " ?";
                values.push(w.value)
            })

        }

        return [query, values]
    }

    async get(): Promise<InstanceType<T>[]> {
        const [results] = await Database.select(...this.build())
        if (this.cast) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return results.map(row => this.cast!.fromRow(row) as any)
        }
        return results
    }
}