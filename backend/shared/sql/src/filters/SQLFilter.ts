import { SimpleError } from '@simonbackx/simple-errors';
import { compileFilter, FilterCompiler, FilterDefinitions, filterDefinitionsToCompiler, RequiredFilterCompiler, StamhoofdFilter } from '@stamhoofd/structures';
import { SQLExpression, SQLExpressionOptions, SQLQuery } from '../SQLExpression.js';
import { SQLJoin } from '../SQLJoin.js';
import { SQLJsonValue } from '../SQLJsonExpressions.js';
import { SQLSelect } from '../SQLSelect.js';
import { SQLWhere, SQLWhereAnd, SQLWhereExists, SQLWhereJoin, SQLWhereNot, SQLWhereOr } from '../SQLWhere.js';
import { $equalsSQLFilterCompiler, $greaterThanSQLFilterCompiler, $inSQLFilterCompiler, $lessThanSQLFilterCompiler } from './compilers/index.js';
import { $containsSQLFilterCompiler } from './compilers/contains.js';
import { SQLSafeValue } from '../SQLExpressions.js';

export type SQLSyncFilterRunner = (column: SQLCurrentColumn) => SQLWhere;
export type SQLFilterRunner = (column: SQLCurrentColumn) => Promise<SQLWhere> | SQLWhere;
export type SQLFilterCompiler = FilterCompiler<SQLFilterRunner>;
export type SQLRequiredFilterCompiler = RequiredFilterCompiler<SQLFilterRunner>;
export type SQLFilterDefinitions = FilterDefinitions<SQLFilterRunner>;

export enum SQLValueType {
    /** At the root of a select */
    Table = 'Table',

    /** Column with type string */
    String = 'String',

    /** MySQL Datetime */
    Datetime = 'Datetime',

    /** Column with type number */
    Number = 'Number',

    /** Column with type boolean, meaning 1 or 0 */
    Boolean = 'Boolean',

    /** True or false in JSON */
    JSONBoolean = 'JSONBoolean',
    JSONString = 'JSONString',

    JSONNumber = 'JSONNumber',

    /** [...] */
    JSONArray = 'JSONArray',

    /** {...} */
    JSONObject = 'JSONObject',
}

export type SQLCurrentColumn = {
    expression: SQLExpression;

    /**
     * MySQL nullable. Please fill this in correctly! If a value can be null, can not exist (=mysql null), or can be JSONNull, set this to true.
     *
     * Mainly > and < operators will make sure the behaviour is consistent with MySQL sorting (normally comparing with null will always return false in MySQL)
     */
    nullable?: boolean;

    /**
     * JSON nullable
     */

    /**
     * Type of this column, use to normalize values received from filters
     */
    type: SQLValueType;
    checkPermission?: (filter: StamhoofdFilter) => Promise<void>;
};

export function createColumnFilter(column: SQLCurrentColumn, childDefinitions?: SQLFilterDefinitions): SQLFilterCompiler {
    return (filter: StamhoofdFilter) => {
        const compiler = childDefinitions ? filterDefinitionsToCompiler(childDefinitions) : filterDefinitionsToCompiler(baseSQLFilterCompilers);
        const runner = $andSQLFilterCompiler(filter, compiler);

        return async (_: SQLCurrentColumn) => {
            if (column.checkPermission) {
                await column.checkPermission(filter);
            }
            return await runner({
                nullable: false,
                ...column,
            });
        };
    };
}

export function createWildcardColumnFilter(getColumn: (key: string) => SQLCurrentColumn, childDefinitions?: (key: string) => SQLFilterDefinitions, options?: { checkPermission?: (key: string) => Promise<void> }): SQLFilterCompiler {
    const wildcardCompiler = (filter: StamhoofdFilter, _, key: string) => {
        const compiler = childDefinitions ? filterDefinitionsToCompiler(childDefinitions(key)) : filterDefinitionsToCompiler(baseSQLFilterCompilers);
        const runner = $andSQLFilterCompiler(filter, compiler);

        return async (_: SQLCurrentColumn) => {
            if (options?.checkPermission) {
                await options.checkPermission(key);
            }
            const column = getColumn(key);
            if (column.checkPermission) {
                await column.checkPermission(filter);
            }
            return await runner({
                nullable: false,
                ...column,
            });
        };
    };

    return (filter: StamhoofdFilter) => {
        return $andSQLFilterCompiler(filter, wildcardCompiler);
    };
}

/**
 * Filter with a subquery that should return at least one result.
 */
export function createExistsFilter(baseSelect: InstanceType<typeof SQLSelect> & SQLExpression, definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return (filter: StamhoofdFilter, _: SQLFilterCompiler) => {
        if (filter !== null && typeof filter === 'object' && '$elemMatch' in filter) {
            filter = filter['$elemMatch'] as StamhoofdFilter;
        }

        const runner = compileToSQLRunner(filter, definitions);

        return async (_: SQLCurrentColumn) => {
            const w = await runner({
                expression: SQLRootExpression,
                type: SQLValueType.Table,
                nullable: false,
            });
            const q = baseSelect.clone();
            q._columns = [new SQLSafeValue(1)];
            q.andWhere(w);
            return new SQLWhereExists(q);
        };
    };
}

/**
 * WARNING: only use this on one-to-one relations. Using it on one-to-many relations will result in duplicate results.
 *
 * By default doesRelationAlwaysExist is set to true, this means we expect the relation to always exist. This helps optimize the query (dropping the join if the where clause in the join is always true)
 */
export function createJoinedRelationFilter(join: SQLJoin, definitions: SQLFilterDefinitions, options: { doesRelationAlwaysExist: boolean } = { doesRelationAlwaysExist: true }): SQLFilterCompiler {
    return (filter: StamhoofdFilter, _: SQLFilterCompiler) => {
        if (filter !== null && typeof filter === 'object' && '$elemMatch' in filter) {
            filter = filter['$elemMatch'] as StamhoofdFilter;
        }

        return async (_: SQLCurrentColumn) => {
            const w = await compileToSQLFilter(filter, definitions);
            return new SQLWhereJoin(join, w, {
                doesRelationAlwaysExist: options.doesRelationAlwaysExist,
            });
        };
    };
}

export function $andSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompiler): SQLFilterRunner {
    const runners = compileSQLFilter(filter, filters);

    return async (column: SQLCurrentColumn) => {
        const wheres = (await Promise.all(
            runners.map(runner => (runner(column))),
        ));

        return new SQLWhereAnd(wheres);
    };
}

export function $orSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompiler): SQLFilterRunner {
    const runners = compileSQLFilter(filter, filters);

    return async (column: SQLCurrentColumn) => {
        const wheres = (await Promise.all(
            runners.map(runner => (runner(column))),
        ));

        return new SQLWhereOr(wheres);
    };
}

export function $notSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompiler): SQLFilterRunner {
    const andRunner = $andSQLFilterCompiler(filter, filters);

    return async (column: SQLCurrentColumn) => {
        return new SQLWhereNot(await andRunner(column));
    };
}

function invertFilterCompiler(compiler: SQLRequiredFilterCompiler): SQLRequiredFilterCompiler {
    return (filter: StamhoofdFilter, parentCompiler: SQLFilterCompiler) => {
        const runner = compiler(filter, parentCompiler);
        return async (column) => {
            return new SQLWhereNot(await runner(column));
        };
    };
}

export const baseSQLFilterCompilers: SQLFilterDefinitions = {
    $and: $andSQLFilterCompiler,
    $or: $orSQLFilterCompiler,
    $not: $notSQLFilterCompiler,
    $eq: $equalsSQLFilterCompiler,
    $neq: invertFilterCompiler($equalsSQLFilterCompiler),

    $lt: $lessThanSQLFilterCompiler,
    $gt: $greaterThanSQLFilterCompiler,
    $lte: invertFilterCompiler($greaterThanSQLFilterCompiler),
    $gte: invertFilterCompiler($lessThanSQLFilterCompiler),

    $in: $inSQLFilterCompiler,

    $contains: $containsSQLFilterCompiler,
};

const compileSQLFilter = compileFilter<SQLFilterRunner>;

export const SQLRootExpression: SQLExpression = {
    getSQL(options?: SQLExpressionOptions): SQLQuery {
        throw new SimpleError({
            code: 'invalid_filter',
            message: 'Root level filters are not allowed to use $eq or $neq',
        });
    },
};

export function compileToSQLRunner(filter: StamhoofdFilter, definitions: SQLFilterDefinitions): SQLFilterRunner {
    if (filter === null) {
        return () => {
            return new SQLWhereAnd([]); // No filter, return empty where
        };
    }
    const compiler = filterDefinitionsToCompiler(definitions); // this compiler searches in the definition for the right compiler for the given key
    const runner = $andSQLFilterCompiler(filter, compiler);
    return runner;
};

export async function compileToSQLFilter(filter: StamhoofdFilter, filters: SQLFilterDefinitions): Promise<SQLWhere> {
    const runner = compileToSQLRunner(filter, filters);
    return await runner({
        expression: SQLRootExpression,
        type: SQLValueType.Table,
        nullable: false,
    });
};

/**
 * Casts json strings, numbers and booleans to native MySQL types. This includes json null to mysql null.
 */
export function normalizeColumn(column: SQLCurrentColumn): SQLCurrentColumn {
    if (column.type === SQLValueType.JSONString) {
        return {
            expression: new SQLJsonValue(column.expression, 'CHAR'),
            type: SQLValueType.String,
            nullable: column.nullable,
        };
    }

    if (column.type === SQLValueType.JSONBoolean) {
        return {
            expression: new SQLJsonValue(column.expression, 'UNSIGNED'),
            type: SQLValueType.Boolean,
            nullable: column.nullable,
        };
    }

    if (column.type === SQLValueType.JSONNumber) {
        return {
            expression: new SQLJsonValue(column.expression, 'UNSIGNED'),
            type: SQLValueType.Number,
            nullable: column.nullable,
        };
    }
    return column;
}
