import { SQL, SQLColumnExpression, SQLExpression, SQLExpressionOptions, SQLQuery } from '@stamhoofd/sql';
import { Language } from '@stamhoofd/structures';

export class SQLTranslatedStringHelper implements SQLExpression {
    constructor(private columnExpression: SQLColumnExpression, private path: string, private getLanguage: () => Language) {
    }

    getSQL(options?: SQLExpressionOptions): SQLQuery {
        const currentLanguage = this.getLanguage();

        const languageOrder: Language[] = [
            Language.English,
            Language.Dutch,
            Language.French,
        ];

        const languages = moveToFront(languageOrder, currentLanguage);

        const languageValues: SQLExpression[] = languages.map((language) => {
            return SQL.jsonValue(this.columnExpression, `${this.path}.${language}`, 'CHAR');
        });

        const type: SQLExpression = SQL.jsonType(SQL.jsonExtract(this.columnExpression, this.path));

        return SQL.if(
            type, '=', 'STRING',
        ).then(
            SQL.jsonValue(this.columnExpression, this.path, 'CHAR'),
        ).else(
            SQL.coalesce(...languageValues) as SQLExpression,
        ).getSQL(options);
    }
}

function moveToFront<T>(arr: T[], value: T): T[] {
    const index = arr.indexOf(value);
    if (index === -1 || index === 0) return arr;

    return [arr[index], ...arr.slice(0, index), ...arr.slice(index + 1)];
}
