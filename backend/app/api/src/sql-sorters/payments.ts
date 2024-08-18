import { Payment } from "@stamhoofd/models"
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from "@stamhoofd/sql"
import { Formatter } from "@stamhoofd/utility"

export const paymentSorters: SQLSortDefinitions<Payment> = {
    'id': {
        getValue(a) {
            return a.id
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction
            })
        }
    },
    'createdAt': {
        getValue(a) {
            return Formatter.dateTimeIso(a.createdAt, 'UTC')
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('createdAt'),
                direction
            })
        }
    },
    'paidAt': {
        getValue(a) {
            return a.paidAt !== null ? Formatter.dateTimeIso(a.paidAt, 'UTC') : null
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('paidAt'),
                direction
            })
        }
    },
    'price': {
        getValue(a) {
            return a.price
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('price'),
                direction
            })
        }
    }
}
