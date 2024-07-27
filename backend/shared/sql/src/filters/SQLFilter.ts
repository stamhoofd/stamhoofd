import { SimpleError } from "@simonbackx/simple-errors";
import { StamhoofdFilter, StamhoofdKeyFilterValue } from "@stamhoofd/structures";
import { SQL } from "../SQL";
import { SQLExpression } from "../SQLExpression";
import { SQLArray, SQLColumnExpression, SQLNull, SQLSafeValue, SQLScalarValue, scalarToSQLExpression, scalarToSQLJSONExpression } from "../SQLExpressions";
import { SQLJsonContains, SQLJsonOverlaps, SQLJsonSearch } from "../SQLJsonExpressions";
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

function guardScalar(s: any): asserts s is SQLScalarValue|null  {
    if (typeof s !== 'string' && typeof s !== 'number' && typeof s !== 'boolean' && !(s instanceof Date) && s !== null) {
        throw new Error('Invalid scalar value')
    }

}

function guardNotNullScalar(s: any): asserts s is SQLScalarValue  {
    if (typeof s !== 'string' && typeof s !== 'number' && typeof s !== 'boolean' && !(s instanceof Date)) {
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

export function createSQLExpressionFilterCompiler(sqlExpression: SQLExpression, normalizeValue?: (v: SQLScalarValue|null) => SQLScalarValue|null, isJSONValue = false, isJSONObject = false): SQLFilterCompiler {
    const norm = normalizeValue ?? ((v) => v);
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

        
        const f = filter as any;

        if ('$eq' in f) {
            guardScalar(f.$eq);

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
                return new SQLWhereEqual(
                    new SQLJsonContains(
                        sqlExpression, 
                        convertToExpression(JSON.stringify(v))
                    ), 
                    SQLWhereSign.Equal, 
                    new SQLSafeValue(1)
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

            if (isJSONObject) {
                // else
                return new SQLWhereEqual(
                    new SQLJsonOverlaps(
                        sqlExpression, 
                        convertToExpression(JSON.stringify(v))
                    ), 
                    SQLWhereSign.Equal, 
                    new SQLSafeValue(1)
                );
            }

            const nullIncluded = v.includes(null);
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
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLArray(v));
        }

        if ('$neq' in f) {
            guardScalar(f.$neq);

            if (isJSONObject) {
                const v = norm(f.$eq);

                // if (typeof v === 'string') {
                //     return new SQLWhereEqual(
                //         new SQLJsonSearch(sqlExpression, 'one', convertToExpression(v)), 
                //         SQLWhereSign.Equal, 
                //         new SQLNull()
                //     );
                // }

                // else
                return new SQLWhereEqual(
                    new SQLJsonContains(
                        sqlExpression, 
                        convertToExpression(JSON.stringify(v))
                    ), 
                    SQLWhereSign.Equal, 
                    new SQLSafeValue(0)
                );
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, convertToExpression(norm(f.$neq)));
        }

        if ('$gt' in f) {
            guardScalar(f.$gt);

            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place')
            }

            if (f.$gt === null) {
                // > null is same as not equal to null (everything is larger than null in mysql) - to be consistent with order by behaviour
                return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, convertToExpression(null));
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Greater, convertToExpression(norm(f.$gt)));
        }

        if ('$gte' in f) {
            guardScalar(f.$gte);

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
            guardScalar(f.$lte);

            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place')
            }

            if (f.$lte === null) {
                // <= null is same as equal to null
                return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, convertToExpression(norm(f.$lte)));
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.LessEqual, convertToExpression(norm(f.$lte)));
        }


        if ('$lt' in f) {
            guardScalar(f.$lt);

            if (isJSONObject) {
                throw new Error('Less than is not supported in this place')
            }

            if (f.$lt === null) {
                // < null is always nothing, there is nothing smaller than null in MySQL - to be consistent with order by behaviour
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(0));
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Less, convertToExpression(norm(f.$lt)));
        }

        if ('$contains' in f) {
            guardString(f.$contains);

            if (isJSONObject) {
                return new SQLWhereEqual(
                    new SQLJsonSearch(
                        sqlExpression, 
                        'one',
                        convertToExpression(
                            '%'+SQLWhereLike.escape(f.$contains)+'%'
                        )
                    ), 
                    SQLWhereSign.NotEqual, 
                    new SQLNull()
                );
            }
            
            return new SQLWhereLike(
                sqlExpression, 
                convertToExpression(
                    '%'+SQLWhereLike.escape(f.$contains)+'%'
                )
            );
        }

        throw new Error('Invalid filter ' + JSON.stringify(f))
    }
}

export function createSQLColumnFilterCompiler(name: string | SQLColumnExpression, normalizeValue?: (v: SQLScalarValue|null) => SQLScalarValue|null): SQLFilterCompiler {
    const column = name instanceof SQLColumnExpression ? name : SQL.column(name);
    return createSQLExpressionFilterCompiler(column, normalizeValue)
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
