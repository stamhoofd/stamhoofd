import type { SQLFilterDefinitions} from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const userFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    verified: createColumnFilter({
        expression: SQL.column('verified'),
        type: SQLValueType.Boolean,
        nullable: false,
    }),
};
