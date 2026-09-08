import type { SQLColumnExpression, SQLExpression, SQLExpressionOptions, SQLQuery } from '@stamhoofd/sql';
import { SQLTranslatedStringHelper } from '@stamhoofd/sql';

export class SQLTranslatedString implements SQLExpression {
    private helper: SQLTranslatedStringHelper;

    constructor(columnExpression: SQLColumnExpression, path: string) {
        // Has to resolve to the same value as TranslatedString.toString(), because pagination compares against that value
        this.helper = new SQLTranslatedStringHelper(columnExpression, path, () => $getLanguage());
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return this.helper.getSQL(options);
    }
}
