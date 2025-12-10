import { Order } from '@stamhoofd/models';
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';

export const orderSorters: SQLSortDefinitions<Order> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY!
    // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
    // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
    // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
    // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
    // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
    // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.
    createdAt: {
        getValue(a) {
            return Formatter.dateTimeIso(a.createdAt);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('createdAt'),
                direction,
            });
        },
    },
    updatedAt: {
        getValue(a) {
            return Formatter.dateTimeIso(a.updatedAt);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('updatedAt'),
                direction,
            });
        },
    },
    id: {
        getValue(a) {
            return a.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    number: {
        getValue(a) {
            return a.number;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('number'),
                direction,
            });
        },
    },
    status: {
        getValue(a) {
            return a.status;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('status'),
                direction,
            });
        },
    },
    paymentMethod: {
        getValue(a) {
            return a.data.paymentMethod;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonExtract(SQL.column('data'), '$.value.paymentMethod'),
                direction,
            });
        },
    },
    checkoutMethod: {
        getValue(a) {
            return a.data.checkoutMethod?.type;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonExtract(SQL.column('data'), '$.value.checkoutMethod.type'),
                direction,
            });
        },
    },
    timeSlotDate: {
        getValue(a) {
            return a.data.timeSlot?.date.getTime();
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonExtract(SQL.column('data'), '$.value.timeSlot.date'),
                direction,
            });
        },
    },
    timeSlotTime: {
        getValue(a) {
            return a.data.timeSlot?.endTime;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonExtract(SQL.column('data'), '$.value.timeSlot.endTime'),
                direction,
            });
        },
    },
    validAt: {
        getValue(a) {
            return a.validAt?.getTime();
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('validAt'),
                direction,
            });
        },
    },
    totalPrice: {
        getValue(a) {
            return a.data.totalPrice;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonExtract(SQL.column('data'), '$.value.totalPrice'),
                direction,
            });
        },
    },
    // amount: {
    //     getValue: (order) => {
    //         return order.data.cart.items.reduce((acc, item) => {
    //             return acc + item.amount;
    //         }, 0);
    //     }
    // }
};
