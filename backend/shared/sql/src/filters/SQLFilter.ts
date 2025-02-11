import { SimpleError } from '@simonbackx/simple-errors';
import { StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { SQL } from '../SQL';
import { SQLExpression } from '../SQLExpression';
import { SQLArray, SQLCast, SQLColumnExpression, SQLLower, SQLNull, SQLSafeValue, SQLScalarValue, scalarToSQLExpression } from '../SQLExpressions';
import { SQLJsonContains, SQLJsonOverlaps, SQLJsonSearch, SQLJsonUnquote, scalarToSQLJSONExpression } from '../SQLJsonExpressions';
import { SQLSelect } from '../SQLSelect';
import { SQLWhere, SQLWhereAnd, SQLWhereEqual, SQLWhereExists, SQLWhereJoin, SQLWhereLike, SQLWhereNot, SQLWhereOr, SQLWhereSign } from '../SQLWhere';
import { SQLJoin } from '../SQLJoin';

export type SQLFilterCompiler = (filter: StamhoofdFilter, filters: SQLFilterDefinitions) => Promise<SQLWhere | null> | SQLWhere | null;
export type SQLFilterDefinitions = Record<string, SQLFilterCompiler>;

export async function andSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): Promise<SQLWhere> {
    const runners = await compileSQLFilter(filter, filters);
    return new SQLWhereAnd(runners);
}

export async function orSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): Promise<SQLWhere> {
    const runners = await compileSQLFilter(filter, filters);
    return new SQLWhereOr(runners);
}

export async function notSQLFilterCompiler(filter: StamhoofdFilter, filters: SQLFilterDefinitions): Promise<SQLWhere> {
    const andRunner = await andSQLFilterCompiler(filter, filters);
    return new SQLWhereNot(andRunner);
}

function guardFilterCompareValue(val: any): StamhoofdCompareValue {
    if (val instanceof Date) {
        return val;
    }

    if (typeof val === 'string') {
        return val;
    }

    if (typeof val === 'number') {
        return val;
    }

    if (typeof val === 'boolean') {
        return val;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        if (val['$'] === '$now') {
            return val;
        }
    }

    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.');
}

function doNormalizeValue(val: StamhoofdCompareValue, options?: SQLExpressionFilterOptions): string | number | Date | null | boolean {
    if (val instanceof Date) {
        return val;
    }

    if (typeof val === 'string') {
        if (options?.isJSONObject) {
            return val;
        }
        return val.toLocaleLowerCase();
    }

    if (typeof val === 'boolean') {
        if (options?.type === SQLValueType.JSONBoolean) {
            return val;
        }
        return val === true ? 1 : 0;
    }

    if (typeof val === 'number') {
        if (options?.type === SQLValueType.JSONBoolean) {
            return val === 1 ? true : false;
        }

        return val;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        const specialValue = val['$'];

        switch (specialValue) {
            case '$now':
                return doNormalizeValue(new Date());
            default:
                throw new Error('Unsupported magic value ' + specialValue);
        }
    }

    return val;
}

/**
 * WARNING: only use this on one-to-one relations. Using it on one-to-many relations will result in duplicate results.
 */
export function createSQLJoinedRelationFilterCompiler(join: SQLJoin, definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return async (filter: StamhoofdFilter) => {
        const f = filter as any;

        if ('$elemMatch' in f) {
            // $elemMatch is also supported but not required (since this is a one-to-one relation)
            const w = await compileToSQLFilter(f['$elemMatch'] as StamhoofdFilter, definitions);
            return new SQLWhereJoin(join, w);
        }

        const w = await compileToSQLFilter(filter, definitions);
        return new SQLWhereJoin(join, w);
    };
}

export function createSQLRelationFilterCompiler(baseSelect: InstanceType<typeof SQLSelect> & SQLExpression, definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return async (filter: StamhoofdFilter) => {
        const f = filter as any;

        if ('$elemMatch' in f) {
            const w = await compileToSQLFilter(f['$elemMatch'], definitions);
            const q = baseSelect.clone().where(w);
            return new SQLWhereExists(q);
        }

        throw new SimpleError({
            code: 'invalid_filter',
            message: 'Invalid filter',
            human: $t('Deze filter wordt niet ondersteund, probeer een andere filter of neem contact op'),
        });
    };
}

// Already joined, but creates a namespace
export function createSQLFilterNamespace(definitions: SQLFilterDefinitions): SQLFilterCompiler {
    return (filter: StamhoofdFilter) => {
        return andSQLFilterCompiler(filter, definitions);
    };
}

export enum SQLValueType {
    JSONBoolean = 'JSONBoolean',
    JSONString = 'JSONString',
}

type SQLExpressionFilterOptions = {
    normalizeValue?: (v: SQLScalarValue | null) => SQLScalarValue | null;
    isJSONValue?: boolean;
    isJSONObject?: boolean;
    nullable?: boolean;

    /**
     * Type of this column, use to normalize values received from filters
     */
    type?: SQLValueType;
    checkPermission?: () => Promise<void>;
};

export function createSQLExpressionFilterCompiler(sqlExpression: SQLExpression, options: SQLExpressionFilterOptions = {}): SQLFilterCompiler {
    const { isJSONObject = false, isJSONValue = false, nullable = false } = options;
    let normalizeValue = options.normalizeValue;
    normalizeValue = normalizeValue ?? (v => v);
    const norm = (val: any) => {
        const n = doNormalizeValue(guardFilterCompareValue(val), options);
        return normalizeValue(n);
    };

    if (isJSONValue) {
        const castJsonType = (expression: SQLExpression, type: SQLValueType | undefined): SQLExpression => {
            if (type === undefined) {
                return expression;
            }

            switch (type) {
                case SQLValueType.JSONBoolean: {
                    return expression;
                }
                case SQLValueType.JSONString: {
                    return new SQLCast(new SQLJsonUnquote(expression), 'CHAR');
                }
            }
        };

        sqlExpression = castJsonType(sqlExpression, options.type);
    }

    const convertToExpression = isJSONValue ? scalarToSQLJSONExpression : scalarToSQLExpression;

    return async (filter: StamhoofdFilter, filters: SQLFilterDefinitions) => {
        if (options.checkPermission) {
            // throws error if no permissions
            await options.checkPermission();
        }

        if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined || filter instanceof Date) {
            filter = {
                $eq: filter,
            };
        }

        if (Array.isArray(filter)) {
            throw new Error('Unexpected array in filter');
        }

        const f = filter;

        if ('$eq' in f) {
            if (isJSONObject) {
                const v = norm(f.$eq);

                if (typeof v === 'string') {
                    // Custom query to support case insensitive comparing

                    return new SQLWhereEqual(
                        new SQLJsonSearch(
                            new SQLLower(sqlExpression),
                            'one',
                            convertToExpression(
                                SQLWhereLike.escape(v.toLocaleLowerCase()),
                            ),
                        ),
                        SQLWhereSign.NotEqual,
                        new SQLNull(),
                    );
                }
                // else
                return new SQLJsonContains(
                    sqlExpression,
                    convertToExpression(v),
                );
            }

            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, convertToExpression(norm(f.$eq)));
        }

        if ('$in' in f) {
            if (!Array.isArray(f.$in)) {
                throw new SimpleError({
                    code: 'invalid_filter',
                    message: 'Expected array at $in filter',
                });
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
                            convertToExpression(JSON.stringify(v)), // contains json null
                        ),
                    ]);
                }

                // else
                return new SQLJsonOverlaps(
                    sqlExpression,
                    convertToExpression(JSON.stringify(v)),
                );
            }

            const createSqlArray = (value: SQLScalarValue[]): SQLArray => {
                if (isJSONValue) {
                    const type = options.type;

                    switch (type) {
                        case SQLValueType.JSONBoolean: {
                            // todo;
                            break;
                        }
                        case SQLValueType.JSONString: {
                            break;
                        }
                    }
                }

                return new SQLArray(value);
            };

            if (nullIncluded) {
                const remaining = v.filter(v => v !== null);
                if (remaining.length === 0) {
                    return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull());
                }
                return new SQLWhereOr([
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()),
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, createSqlArray(remaining)),
                ]);
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, createSqlArray(v as SQLScalarValue[]));
        }

        if ('$neq' in f) {
            if (isJSONObject) {
                const v = norm(f.$neq);

                return new SQLWhereNot(
                    new SQLJsonContains(
                        sqlExpression,
                        convertToExpression(JSON.stringify(v)),
                    ),
                );
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.NotEqual, convertToExpression(norm(f.$neq)));
        }

        if ('$gt' in f) {
            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place');
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
                throw new Error('Greater than is not supported in this place');
            }

            if (f.$gte === null) {
                // >= null is always everything
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(1));
            }
            return new SQLWhereEqual(sqlExpression, SQLWhereSign.GreaterEqual, convertToExpression(norm(f.$gte)));
        }

        if ('$lte' in f) {
            if (isJSONObject) {
                throw new Error('Greater than is not supported in this place');
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
                    base,
                ]);
            }

            return new SQLWhereEqual(sqlExpression, SQLWhereSign.LessEqual, convertToExpression(norm(f.$lte)));
        }

        if ('$lt' in f) {
            if (isJSONObject) {
                throw new Error('Less than is not supported in this place');
            }

            if (f.$lt === null) {
                // < null is always nothing, there is nothing smaller than null in MySQL - to be consistent with order by behaviour
                return new SQLWhereEqual(new SQLSafeValue(1), SQLWhereSign.Equal, new SQLSafeValue(0));
            }

            const base = new SQLWhereEqual(sqlExpression, SQLWhereSign.Less, convertToExpression(norm(f.$lt)));

            if (nullable) {
                return new SQLWhereOr([
                    // Null values are also smaller than any value  - required for sorting
                    new SQLWhereEqual(sqlExpression, SQLWhereSign.Equal, new SQLNull()),
                    base,
                ]);
            }

            return base;
        }

        if ('$contains' in f) {
            const needle = norm(f.$contains);

            if (typeof needle !== 'string') {
                throw new Error('Invalid needle for contains filter');
            }

            if (isJSONObject) {
                return new SQLWhereEqual(
                    new SQLJsonSearch(
                        new SQLLower(sqlExpression),
                        'one',
                        convertToExpression(
                            '%' + SQLWhereLike.escape(needle) + '%',
                        ),
                    ),
                    SQLWhereSign.NotEqual,
                    new SQLNull(),
                );
            }

            if (isJSONValue) {
                // We need to do case insensitive search, so need to convert the sqlExpression from utf8mb4 to varchar
                return new SQLWhereLike(
                    new SQLCast(new SQLJsonUnquote(sqlExpression), 'CHAR'),
                    convertToExpression(
                        '%' + SQLWhereLike.escape(needle) + '%',
                    ),
                );
            }

            return new SQLWhereLike(
                sqlExpression,
                convertToExpression(
                    '%' + SQLWhereLike.escape(needle) + '%',
                ),
            );
        }

        throw new SimpleError({
            code: 'invalid_filter',
            message: 'Invalid filter',
            human: $t('Deze filter wordt niet ondersteund, probeer een andere filter of neem contact op'),
        });
    };
}

export function createSQLColumnFilterCompiler(name: string | SQLColumnExpression, options?: SQLExpressionFilterOptions): SQLFilterCompiler {
    const column = name instanceof SQLColumnExpression ? name : SQL.column(name);
    return createSQLExpressionFilterCompiler(column, options);
}

export const baseSQLFilterCompilers: SQLFilterDefinitions = {
    $and: andSQLFilterCompiler,
    $or: orSQLFilterCompiler,
    $not: notSQLFilterCompiler,
};

function objectToArray(f: StamhoofdFilter & object): StamhoofdFilter[] {
    const splitted: StamhoofdFilter[] = [];
    for (const key of Object.keys(f)) {
        splitted.push({ [key]: f[key] });
    }
    return splitted;
}

async function compileSQLFilter(filter: StamhoofdFilter, definitions: SQLFilterDefinitions): Promise<SQLWhere[]> {
    if (filter === undefined) {
        return [];
    }

    const runners: SQLWhere[] = [];

    for (const f of (Array.isArray(filter) ? filter : (typeof filter === 'object' && filter !== null ? objectToArray(filter) : [filter]))) {
        if (!f) {
            continue;
        }
        if (!(typeof f === 'object' && f !== null)) {
            throw new Error('Unsupported filter at this position: ' + f);
        }

        if (Object.keys(f).length > 1) {
            // Multiple keys in the same object should always be combined with AND
            runners.push(await andSQLFilterCompiler(objectToArray(f), definitions));
            continue;
        }

        if (Array.isArray(f)) {
            // Arrays in filters not direclty underneath $and or $or should be combined with AND
            runners.push(await andSQLFilterCompiler(f, definitions));
            continue;
        }

        for (const key of Object.keys(f)) {
            let ff = definitions[key];
            let value: StamhoofdFilter = f[key];

            if (!ff) {
                // Search with dot syntax shortcuts
                if (key.includes('.')) {
                    const parts = key.split('.');

                    if (parts.length >= 2 && parts.every(p => p.length > 0)) {
                        let subKey = parts.shift() ?? '';

                        while (parts.length && !definitions[subKey]) {
                            subKey = subKey + '.' + parts.shift();
                        }

                        if (subKey && definitions[subKey]) {
                            const remaining = parts.join('.');

                            const transformeInto = {
                                [remaining]: value,
                            };

                            ff = definitions[subKey];
                            value = transformeInto;
                        }
                    }
                }
            }

            if (!ff) {
                throw new SimpleError({
                    code: 'invalid_filter',
                    message: 'Invalid filter ' + key,
                    human: $t('Deze filter wordt niet ondersteund, probeer een andere filter of neem contact op'),
                });
            }

            const s = await ff(value, definitions);
            if (s === undefined || s === null) {
                throw new SimpleError({
                    code: 'invalid_filter',
                    message: 'Invalid filter value for filter ' + key,
                    human: $t('Deze filter wordt niet ondersteund, probeer een andere filter of neem contact op'),
                });
            }
            runners.push(s);
        }
    }

    return runners;
}

export const compileToSQLFilter = andSQLFilterCompiler;
