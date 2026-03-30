import { Database } from '@simonbackx/simple-database';

const EXPECTED_COLLATION = 'utf8mb4_0900_ai_ci';

type CollationRow = {
    collationConnection: string;
    collationDatabase: string;
};

export class DatabaseCollationService {
    static expectedCollation = EXPECTED_COLLATION;

    static async getCurrentCollations() {
        const connectionResult = await Database.statement("SHOW VARIABLES LIKE 'collation_connection'");
        const databaseResult = await Database.statement("SHOW VARIABLES LIKE 'collation_database'");

        const collationConnection = this.extractVariableValue(connectionResult);
        const collationDatabase = this.extractVariableValue(databaseResult);

        return {
            collationConnection: typeof collationConnection === 'string' ? collationConnection : '',
            collationDatabase: typeof collationDatabase === 'string' ? collationDatabase : '',
        } as CollationRow;
    }

    private static extractVariableValue(result: unknown) {
        if (result && typeof result === 'object' && 'rows' in result) {
            return this.extractVariableValue((result as { rows: unknown }).rows);
        }

        if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
            return this.extractVariableValue(result[0]);
        }

        if (!Array.isArray(result) || result.length === 0) {
            return '';
        }

        const firstRow = result[0] as Record<string, unknown> | undefined;

        if (!firstRow) {
            return '';
        }

        const value = firstRow.Value
            ?? firstRow.value
            ?? firstRow.VARIABLE_VALUE
            ?? firstRow.variable_value;

        if (typeof value === 'string') {
            return value;
        }

        for (const candidate of Object.values(firstRow)) {
            if (typeof candidate === 'string' && candidate.startsWith('utf8mb4_')) {
                return candidate;
            }
        }

        return '';
    }

    static async getMismatchError() {
        const collations = await this.getCurrentCollations();
        const mismatches: string[] = [];

        if (collations.collationConnection !== this.expectedCollation) {
            mismatches.push(`collation_connection=${collations.collationConnection}`);
        }

        if (collations.collationDatabase !== this.expectedCollation) {
            mismatches.push(`collation_database=${collations.collationDatabase}`);
        }

        if (mismatches.length === 0) {
            return null;
        }

        return `MySQL collation mismatch: expected ${this.expectedCollation}, got ${mismatches.join(', ')}`;
    }
}
