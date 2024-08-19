import { MemberWithRegistrations } from "@stamhoofd/models"
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from "@stamhoofd/sql"
import { Formatter } from "@stamhoofd/utility"

export const memberSorters: SQLSortDefinitions<MemberWithRegistrations> = {
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
    'name': {
        getValue(a) {
            return a.details.name
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return SQLOrderBy.combine([
                new SQLOrderBy({
                    column: SQL.column('firstName'),
                    direction
                }),
                new SQLOrderBy({
                    column: SQL.column('lastName'),
                    direction
                })
            ])
        }
    },
    'birthDay': {
        getValue(a) {
            return a.details.birthDay ? Formatter.dateIso(a.details.birthDay) : null
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('birthDay'),
                direction
            })
        }
    }
    // Note: never add mapped sortings, that should happen in the frontend -> e.g. map age to birthDay
}