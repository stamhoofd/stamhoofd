import { SQL } from '../src/SQL.js';
import { SQLWhereSign } from '../src/SQLWhere.js';

describe('SQLWhere', () => {
    describe('empty arrays', () => {
        it('an empty IN array is always false', () => {
            const where = SQL.where('memberId', []);
            expect(where.isAlways).toBe(false);
        });

        it('an empty NOT IN array is always true', () => {
            const where = SQL.where('memberId', SQLWhereSign.NotEqual, []);
            expect(where.isAlways).toBe(true);
        });

        it('an empty IN array is removed from an OR', () => {
            const where = SQL.where('memberId', []).or('userId', 'abc');
            expect(where.getSQL({ defaultNamespace: 'default' })).toEqual({
                query: '`default`.`userId` = ?',
                params: ['abc'],
            });
        });

        it('a select with an empty IN array inside an OR compiles', () => {
            const select = SQL.select().from('balance_items').where(SQL.where('memberId', []).or('userId', 'abc'));
            expect(select.getSQL()).toEqual({
                query: 'SELECT `balance_items`.* FROM `balance_items` WHERE `balance_items`.`userId` = ?',
                params: ['abc'],
            });
        });
    });
});
