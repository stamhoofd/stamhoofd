export type SQLExpressionOptions = {
    defaultNamespace?: string
};

export type NormalizedSQLQuery = {query: string; params: any[]}
export type SQLQuery = NormalizedSQLQuery|string

export function joinSQLQuery(queries: (SQLQuery|undefined|null)[], seperator?: string): NormalizedSQLQuery {
    queries = queries.filter(q => q !== undefined && q !== null)
    return {
        query: queries.map(q => typeof q === 'string' ? q : q!.query).join(seperator ?? ''),
        params: queries.flatMap(q => typeof q === 'string' ? [] : q!.params)
    }
}

export function normalizeSQLQuery(q: SQLQuery): NormalizedSQLQuery {
    return {
        query: typeof q === 'string' ? q : q.query,
        params: typeof q === 'string' ? [] : q.params
    }
}


export interface SQLExpression {
    getSQL(options?: SQLExpressionOptions): SQLQuery
}

export function isSQLExpression(obj: unknown): obj is SQLExpression {
    return typeof obj === 'object' && obj !== null && !!(obj as any).getSQL && typeof (obj as any).getSQL === 'function'
}
