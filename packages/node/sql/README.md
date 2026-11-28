# @stamhoofd/node-sql

A typed SQL query builder on top of `@stamhoofd/node-database`, plus compilers that turn a `StamhoofdFilter` or `SortList` from `@stamhoofd/common-filters` into SQL.

## Errors

Errors that can reach end users are `SimpleError`s with a `code` and an English `message`, but no `human` message. Translate these codes in your application:

| Code                     | Thrown when                                            |
| ------------------------ | ------------------------------------------------------ |
| `invalid_sort`           | A sort key has no definition                           |
| `sorter_join_overlap`    | Two sorters use separate joins on the same table       |
| `too_many_filter_values` | A `$in` filter has more than 1000 values               |
| `unknown_filter`         | A filter key has no definition (from `common-filters`) |

The Stamhoofd API does this in `HumanErrorMessageMiddleware`. Other codes, such as `empty_sort` and `invalid_filter`, indicate a bug in the caller and need no translation.

## Tests

Run `pnpm stam test sql` from the repository root. It starts the managed test MySQL.
