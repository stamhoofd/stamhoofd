import { MemberResponsibilityRecord } from '@stamhoofd/models';
import type { SQLFilterDefinitions} from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

const baseTable = SQL.table(MemberResponsibilityRecord.table);

/**
 * Defines how to filter member responsibility records in the database from StamhoofdFilter objects
 */
export const memberResponsibilityRecordFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    responsibilityId: createColumnFilter({
        expression: SQL.column(baseTable, 'responsibilityId'),
        type: SQLValueType.String,
        nullable: false,
    }),
};
