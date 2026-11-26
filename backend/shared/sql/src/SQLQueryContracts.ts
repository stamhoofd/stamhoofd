import type { ModelTarget } from '@node/database';
import type { SQLExpression, SQLNamedExpression } from './SQLExpression.js';

export enum SQLJoinType {
    Left = 'Left',
    Right = 'Right',
    Inner = 'Inner',
    Outer = 'Outer',
}

export interface SQLJoinExpression extends SQLExpression {
    type: SQLJoinType;
    table: SQLNamedExpression;
}

// Nominal identity for SELECT-specific handling without importing the query builder.
export class SQLSelectBase {
    get modelTargets(): ModelTarget[] | undefined {
        return undefined;
    }
    get isAlways(): boolean | null {
        return null;
    }
}
