import { Organization } from "@stamhoofd/models"
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from "@stamhoofd/sql"

export const organizationSorters: SQLSortDefinitions<Organization> = {
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
            return a.name
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('name'),
                direction
            })
        }
    },
    'uri': {
        getValue(a) {
            return a.uri
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('uri'),
                direction
            })
        }
    },
    'type': {
        getValue(a) {
            return a.meta.type
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('meta'), '$.value.type'),
                direction
            })
        }
    },
    'city': {
        getValue(a) {
            return a.address.city
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('address'), '$.value.city'),
                direction
            })
        }
    },
    'country': {
        getValue(a) {
            return a.address.country
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('address'), '$.value.country'),
                direction
            })
        }
    }
}
