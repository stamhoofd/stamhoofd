import { SQLColumnExpression, SQLExpression, SQLExpressionOptions, SQLQuery, SQLTranslatedStringHelper } from '@stamhoofd/sql';
import { Language } from '@stamhoofd/structures';

export class SQLTranslatedString implements SQLExpression {
    private helper: SQLTranslatedStringHelper;

    constructor(columnExpression: SQLColumnExpression, path: string) {
        this.helper = new SQLTranslatedStringHelper(columnExpression, path, () => Language.English);
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        return this.helper.getSQL(options);
    }
}
