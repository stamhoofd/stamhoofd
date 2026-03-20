import type { SQLColumnExpression, SQLExpression, SQLExpressionOptions, SQLQuery } from '@stamhoofd/sql';
import { SQLTranslatedStringHelper } from '@stamhoofd/sql';
import { Language } from '@stamhoofd/types/Language';

export class SQLTranslatedString implements SQLExpression {
    private helper: SQLTranslatedStringHelper;

    constructor(columnExpression: SQLColumnExpression, path: string) {
        this.helper = new SQLTranslatedStringHelper(columnExpression, path, () => Language.English);
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return this.helper.getSQL(options);
    }
}
