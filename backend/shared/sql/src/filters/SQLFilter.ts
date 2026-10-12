import { SimpleError } from '@simonbackx/simple-errors';
import { compileFilter, filterDefinitionsToCompiler } from '@stamhoofd/filters/FilterCompilers';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import type { SQLExpression, SQLExpressionOptions, SQLQuery } from '../SQLExpression.js';
import { SQLSafeValue } from '../SQLExpressions.js';
import type { SQLJoin } from '../SQLJoin.js';
import type { SQLSelect } from '../SQLSelect.js';
import type { SQLWhere } from '../SQLWhere.js';
import { SQLWhereAnd, SQLWhereExists, SQLWhereJoin, SQLWhereNot, SQLWhereOr } from '../SQLWhere.js';
import { $containsSQLFilterCompiler } from './compilers/contains.js';
import { $equalsSQLFilterCompiler } from './compilers/equals.js';
import { $greaterThanSQLFilterCompiler } from './compilers/greater.js';
import { $inSQLFilterCompiler } from './compilers/in.js';
import { $lessThanSQLFilterCompiler } from './compilers/less.js';
import type { SQLCurrentColumn, SQLFilterCompiler, SQLFilterDefinitions, SQLFilterRunner, SQLRequiredFilterCompiler } from './SQLFilterTypes.js';
import { SQLValueType } from './SQLFilterTypes.js';

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
            // eslint-disable-next-line @typescript-eslint/await-thenable
            runners.map(runner => (runner(column))),
        ));

        return new SQLWhereAnd(wheres);
    };
}

export function $orSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterCompiler): SQLFilterRunner {
    const runners = compileSQLFilter(filter, filters);

    return async (column: SQLCurrentColumn) => {
        const wheres = (await Promise.all(
            // eslint-disable-next-line @typescript-eslint/await-thenable
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
