import { SimpleError } from "@simonbackx/simple-errors";
import { StamhoofdCompareValue, StamhoofdFilter } from "@stamhoofd/structures";
import { SQL } from "../SQL";
import { SQLExpression } from "../SQLExpression";
import { SQLArray, SQLCast, SQLColumnExpression, SQLNull, SQLSafeValue, SQLScalarValue, scalarToSQLExpression, scalarToSQLJSONExpression } from "../SQLExpressions";
import { SQLJsonContains, SQLJsonOverlaps, SQLJsonSearch, SQLJsonUnquote } from "../SQLJsonExpressions";
import { SQLSelect } from "../SQLSelect";
import { SQLWhere, SQLWhereAnd, SQLWhereEqual, SQLWhereExists, SQLWhereLike, SQLWhereNot, SQLWhereOr, SQLWhereSign } from "../SQLWhere";

export type SQLFilterCompiler = (filter: StamhoofdFilter, filters: SQLFilterDefinitions) => SQLWhere|null;
export type SQLFilterDefinitions = Record<string, SQLFilterCompiler>

export function andSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): SQLWhere {
    const runners = compileSQLFilter(filter, filters);
    return new SQLWhereAnd(runners)
}

export function orSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): SQLWhere {
    const runners = compileSQLFilter(filter, filters);
    return new SQLWhereOr(runners)
}

export function notSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): SQLWhere {
    const andRunner = andSQLFilterCompiler(filter, filters);
    return new SQLWhereNot(andRunner)
}

function guardFilterCompareValue(val: any): StamhoofdCompareValue {
    if (val instanceof Date) {
        return val
    }

    if (typeof val === 'string') {
        return val
    }

    if (typeof val === 'number') {
        return val
    }

    if (typeof val === 'boolean') {
        return val;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && "$" in val) {
        if (val["$"] === '$now') {
            return val;
        }
    }

    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.')
}

function doNormalizeValue(val: StamhoofdCompareValue): string|number|Date|null {
    if (val instanceof Date) {
        return val
    }

    if (typeof val === 'string') {
        return val.toLocaleLowerCase()
    }

    if (typeof val === 'boolean') {
        return val === true ? 1 : 0;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && "$" in val) {
        const specialValue = val["$"];

        switch (specialValue) {
            case '$now':
                return doNormalizeValue(new Date())
            default:
                throw new Error('Unsupported magic value ' + specialValue)
        }
    }

    return val;
}

function guardScalar(s: any): asserts s is SQLScalarValue|null  {
    if (typeof s !== 'string' && typeof s !== 'number' && typeof s !== 'boolean' && !(s instanceof Date) && s !== null) {
        throw new Error('Invalid scalar value')
    }

}

function guardString(s: any): asserts s is string  {
    if (typeof s !== 'string') {
        throw new Error('Invalid string value')
    }
}

export function createSQLRelationFilterCompiler(baseSelect: InstanceType<typeof SQLSelect> & SQLExpression, definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return (filter: StamhoofdFilter) => {
        const f = filter as any;

        if ('$elemMatch' in f) {
            const w = compileToSQLFilter(f['$elemMatch'], definitions)
            const q = baseSelect.clone().where(w);
            return new SQLWhereExists(q)
        }

        throw new Error('Invalid filter')
    }
}

// Already joined, but creates a namespace
export function createSQLFilterNamespace(definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return (filter: StamhoofdFilter) => {
        return andSQLFilterCompiler(filter, definitions)
    }
}

type SQLExpressionFilterOptions = {normalizeValue?: (v: SQLScalarValue|null) => SQLScalarValue|null, isJSONValue?: boolean, isJSONObject?: boolean, nullable?: boolean}

export function createSQLExpressionFilterCompiler(sqlExpression: SQLExpression, {normalizeValue, isJSONObject = false, isJSONValue = false, nullable = false}: SQLExpressionFilterOptions = {}): SQLFilterCompiler {
    normalizeValue = normalizeValue ?? ((v) => v);
    const norm = (val: any) => {
        const n = doNormalizeValue(guardFilterCompareValue(val));
        return normalizeValue(n);
    }
    const convertToExpression = isJSONValue ? scalarToSQLJSONExpression : scalarToSQLExpression

    return (filter: StamhoofdFilter, filters: SQLFilterDefinitions) => {
        if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined) {
            filter = {
                $eq: filter
            }
        }

        if (Array.isArray(filter)) {
            throw new Error('Unexpected array in filter')
        }

        
        const f = filter;

        if ('$eq' in f) {
            if (isJSONObject) {
                const v = norm(f.$eq);

                // if (typeof v === 'string') {
                //     return new SQLWhereEqual(
                //         new SQLJsonSearch(sqlExpression, 'one', convertToExpression(v)), 
                //         SQLWhereSign.NotEqual, 
                //         new SQLNull()
                //     );
                // }

                // else
                return new SQLJsonContains(
                    sqlExpression, 
                    convertToExpression(JSON.stringify(v))
                );
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, convertToExpression(norm(f.$eq)));
        }

        if ('$in' in f) {
            if (!Array.isArray(f.$in)) {
                throw new SimpleError({
                    code: 'invalid_filter',
                    message: 'Expected array at $in filter'
                })
            }

            if (f.$in.length === 0) {
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(0));
            }

            const v = f.$in.map(a => norm(a));
            const nullIncluded = v.includes(null);

            if (isJSONObject) {
                if (nullIncluded) {
                    // PROBLEM: The sql expression can either not exist (= resolve to mysql null), contains null in json (= JSON null), or contain a value.
                    // that makes comparing more difficult, to combat this, we still need to use SQLJsonOverlaps with the JSON null value
                    return new SQLWhereOr([
                        new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()), // checks path not exists (= mysql null)
                        new SQLJsonOverlaps(
                            sqlExpression, 
                            convertToExpression(JSON.stringify(v)) // contains json null
                        )
                    ]);
                }

                // else
                return new SQLJsonOverlaps(
                    sqlExpression, 
                    convertToExpression(JSON.stringify(v))
                );
            }

            if (nullIncluded) {
                const remaining = v.filter(v => v !== null);
                if (remaining.length === 0) {
                    return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull());
                }
                return new SQLWhereOr([
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()),
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLArray(remaining))
                ]);
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLArray(v as SQLScalarValue[]));
        }

        if ('$neq' in f) {
            if (isJSONObject) {
                const v = norm(f.$neq);

                return new SQLWhereNot(
                    new SQLJsonContains(
                        sqlExpression, 
                        convertToExpression(JSON.stringify(v))
                    )
                );
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, convertToExpression(norm(f.$neq)));
        }

        if ('$gt' in f) {
            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place')
            }

            if (f.$gt === null) {
                // > null is same as not equal to null (everything is larger than null in mysql) - to be consistent with order by behaviour
                return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, convertToExpression(null));
            }

            // For MySQL null values are never included in greater than, but we need this for consistent sorting behaviour
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Greater, convertToExpression(norm(f.$gt)));
        }

        if ('$gte' in f) {
            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place')
            }

            if (f.$gte === null) {
                // >= null is always everything
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(1));
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.GreaterEqual, convertToExpression(norm(f.$gte)));
        }

        if ('$lte' in f) {
            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place')
            }

            if (f.$lte === null) {
                // <= null is same as equal to null
                return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, convertToExpression(norm(f.$lte)));
            }

            const base = new SQLWhereEqual(sqlExpression, SQLWhereSign.LessEqual, convertToExpression(norm(f.$lte)));

            if (nullable) {
                return new SQLWhereOr([
                    // Null values are also smaller than any value  - required for sorting
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()),
                   base
                ]);
            }
            
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.LessEqual, convertToExpression(norm(f.$lte)));
        }


        if ('$lt' in f) {
            if (isJSONObject) {
                throw new Error('Less than is not supported in this place')
            }

            if (f.$lt === null) {
                // < null is always nothing, there is nothing smaller than null in MySQL - to be consistent with order by behaviour
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(0));
            }

            const base = new SQLWhereEqual(sqlExpression, SQLWhereSign.Less, convertToExpression(norm(f.$lt)))

            if (nullable) {
                return new SQLWhereOr([
                    // Null values are also smaller than any value  - required for sorting
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()),
                   base
                ]);
            }

            return base;
        }

        if ('$contains' in f) {
            const needle = norm(f.$contains);

            if (typeof needle !== 'string') {
                throw new Error('Invalid needle for contains filter')
            }

            if (isJSONObject) {
                return new SQLWhereEqual(
                    new SQLJsonSearch(
                        sqlExpression, 
                        'one',
                        convertToExpression(
                            '%'+SQLWhereLike.escape(needle)+'%'
                        )
                    ), 
                    SQLWhereSign.NotEqual, 
                    new SQLNull()
                );
            }

            if (isJSONValue) {
                // We need to do case insensitive search, so need to convert the sqlExpression from utf8mb4 to varchar
                return new SQLWhereLike(
                    new SQLCast(new SQLJsonUnquote(sqlExpression), 'CHAR'), 
                    convertToExpression(
                        '%'+SQLWhereLike.escape(needle)+'%'
                    )
                );
            }
            
            return new SQLWhereLike(
                sqlExpression, 
                convertToExpression(
                    '%'+SQLWhereLike.escape(needle)+'%'
                )
            );
        }

        throw new Error('Invalid filter ' + JSON.stringify(f))
    }
}

export function createSQLColumnFilterCompiler(name: string | SQLColumnExpression, options?: SQLExpressionFilterOptions): SQLFilterCompiler {
    const column = name instanceof SQLColumnExpression ? name : SQL.column(name);
    return createSQLExpressionFilterCompiler(column, options)
}

export const baseSQLFilterCompilers: SQLFilterDefinitions = {
    '$and': andSQLFilterCompiler,
    '$or': orSQLFilterCompiler,
    '$not': notSQLFilterCompiler,
}

function compileSQLFilter(filter: StamhoofdFilter, definitions: SQLFilterDefinitions): SQLWhere[] {
    if (filter === undefined) {
        return [];
    }

    const runners: SQLWhere[] = []

    for (const f of (Array.isArray(filter) ? filter : [filter])) {
        if (!f) {
            continue;
        }
        if (Object.keys(f).length > 1) {
            // Multiple keys in the same object should always be combined with AND
            const splitted: StamhoofdFilter[] = [];
            for (const key of Object.keys(f)) {
                splitted.push({ [key]: f[key] })
            }
            runners.push(andSQLFilterCompiler(splitted, definitions));
            continue;
        }
        for (const key of Object.keys(f)) {
            const filter = definitions[key];
            if (!filter) {
                throw new Error('Unsupported filter ' + key)
            }

            const s = filter(f[key] as StamhoofdFilter, definitions)
            if (s === undefined || s === null) {
                throw new Error('Unsupported filter value for ' + key)
            }
            runners.push(s);
        }
    }

    return runners
}

export const compileToSQLFilter = andSQLFilterCompiler
