import { PlainObject } from "@simonbackx/simple-encoding";
import { SQL } from "../SQL";
import { SQLScalarValue, scalarToSQLExpression } from "../SQLExpressions";
import { SQLWhere, SQLWhereAnd, SQLWhereEqual, SQLWhereLike, SQLWhereNot, SQLWhereOr, SQLWhereSign } from "../SQLWhere";
import { StamhoofdFilter, StamhoofdKeyFilterValue } from "@stamhoofd/structures";
import { SQLExpression } from "../SQLExpression";

export type SQLFilterCompiler = (filter: StamhoofdKeyFilterValue, filters: SQLFilterDefinitions) => SQLWhere|null;
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

export function createSQLExpressionFilterCompiler(sqlExpression: SQLExpression, normalizeValue?: (v: SQLScalarValue|null) => SQLScalarValue|null): SQLFilterCompiler {
    const norm = normalizeValue ?? ((v) => v);

    return (filter: StamhoofdKeyFilterValue, filters: SQLFilterDefinitions) => {
        if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined) {
            filter = {
                $eq: filter
            }
        }

        if (Array.isArray(filter)) {
            throw new Error('Unexpected array in filter')
        }

        
        const f = filter as any;

        if (f.$eq) {
            guardScalar(f.$eq);
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, scalarToSQLExpression(norm(f.$eq)));
        }

        if (f.$neq) {
            guardScalar(f.$neq);
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, scalarToSQLExpression(norm(f.$neq)));
        }

        if (f.$gt) {
            guardNotNullScalar(f.$gt);
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Greater, scalarToSQLExpression(norm(f.$gt)));
        }

        if (f.$lt) {
            guardNotNullScalar(f.$lt);
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Less, scalarToSQLExpression(norm(f.$lt)));
        }

        if (f.$contains) {
            guardString(f.$contains);
            return new SQLWhereLike(
                sqlExpression, 
                scalarToSQLExpression(
                    '%'+SQLWhereLike.escape(f.$contains)+'%'
                )
            );
        }

        throw new Error('Invalid filter')
    }
}

export function createSQLColumnFilterCompiler(name: string, normalizeValue?: (v: SQLScalarValue|null) => SQLScalarValue|null): SQLFilterCompiler {
    const column = SQL.column(name);
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
