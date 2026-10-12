# Storing data in the database

Stamhoofd uses MySQL. Database models live primarily in
[`backend/shared/models/src`](../../backend/shared/models/src) and extend
[QueryableModel](../../backend/shared/sql/src/QueryableModel.ts).
`Model`, `column`, save/delete and JSON persistence are provided by simple-database;
see its [model workflow](https://github.com/SimonBackx/simple-database/blob/master/docs/models.md).
**QueryableModel and the SQL query builder are Stamhoofd APIs**, not simple-database APIs.

## Defining and saving models

Use `static table` and `@column(...)` to map the model to an explicitly migrated
table. Use synchronous `beforeSave` callbacks for lazy defaults such as UUIDs
and creation dates; preserve an already assigned value. For an update timestamp,
generate a new date on each save and use `skipUpdate: true` so timestamp-only
changes do not issue an update. Those fields are still written on insert and
alongside other changes. Match the SQL datetime precision (many existing models
clear milliseconds). The [Member model](../../backend/shared/models/src/models/Member.ts)
contains application examples.

```ts
const dog = new Dog(); // illustrative model with migrated columns
dog.name = 'Pablo';
await dog.save();
await dog.save(); // no SQL write unless a relevant field changed
await dog.delete();
```

Decorated JSON columns can store shared structures using their decoder, for
example `@column({ type: 'json', decoder: DogSettings })` with
`settings = DogSettings.create({})`. Prefer an explicit default when appropriate.
Read the [structures overview](../structures/README.md) before changing their format.
The library handles versioned encoding/decoding with the Database medium;
the API boot and migration entry points configure JSON writes with the shared Version.
Keep frequently queried properties in suitable SQL columns. JSON can grow as
properties and nested records accumulate: profile its size and consider splitting
large columns when that improves writes/reads. The old guide flagged member
record answers as a performance TODO; do not treat that historical observation
as a current benchmark or a resolved issue.

## Querying

Import `SQL` from `@stamhoofd/sql/SQL` and extend `QueryableModel` from
`@stamhoofd/sql/QueryableModel`. Prefer `Dog.select()` over the legacy
`Dog.where(...)` interface. The following uses an illustrative Dog model:

```ts
const dogs = await Dog.select()
    .where('name', ['Pablo', 'Otto']) // IN
    .andWhere('createdAt', '<', new Date('2020-01-01'))
    .fetch();

const dog = await Dog.select().where('name', 'Pablo').first(true);
const optionalDog = await Dog.select().where('name', 'Pablo').first(false); // Dog | null
const byId = await Dog.getByID('119df7e7-b619-4c02-b6e8-2ade3e7ca4d7'); // Dog | undefined

const count = await Dog.select().where('name', 'Pablo').count();
const totalAge = await Dog.select().where('name', 'Pablo').sum(SQL.column('age'));

const ownedDogs = await Dog.select()
    .where('name', 'Pablo')
    .andWhere(SQL.where('ownerName', 'Simon').or('ownerName', 'Bjarne'))
    .fetch();
```

Use `first(true)` for required rows (`first`'s implementation defaults to required,
but its TypeScript overloads require an argument). `first(false)` returns null;
`getByID` returns undefined unless its required flag is true. Aggregates mutate
the query and clear pagination/order; do not reuse that builder for a model fetch.
The current `sum` implementation accepts integer numeric results and otherwise
returns 0, so do not use it as a general decimal aggregation contract.

## Iterating large result sets

Avoid fetching arbitrarily large arrays. `all()` yields individual models;
`allBatched()` yields arrays. Both use batches of 100 by default; `limit(...)`
sets batch size, not the total result limit. Pagination requires a selected
string primary key and does not accept custom ordering or offsets.

```ts
for await (const dog of Dog.select().all()) {
    await processDog(dog);
}

for await (const dogs of Dog.select().limit(100).allBatched()) {
    await processDogs(dogs);
}

for await (const dog of Dog.select().limit(10).all().maxQueries(5)) {
    await processDog(dog); // at most 50 rows, possibly fewer
}
```

See [SQLSelect](../../backend/shared/sql/src/SQLSelect.ts) for iterator and
fetch contracts. Batch iteration yields arrays, not individual models.

## Deleting

```ts
await dog.delete(); // instance: saved row by primary key
await Dog.delete().where('name', 'Pablo'); // query: matching rows
```

`await Dog.delete()` deletes **every row**. The static query builder is thenable;
the instance method also updates saved state and emits a model event. Do not
assume bulk deletion invokes instance lifecycle hooks.

## Migrations

Creating a model or changing columns does not change the database schema.
Write a migration and have it reviewed in a PR; do not commit migrations directly
to main. Most application migrations live in
[`backend/shared/models/src/migrations`](../../backend/shared/models/src/migrations);
other database owners can have their own migration directory.

1. Get a UNIX timestamp with `date +%s` to order the migration.
2. Create `<timestamp>-<description>.sql` in the owning migration directory.
3. Write the SQL schema change. A tool such as TablePlus can generate starting SQL;
   check it against the model's types, defaults and nullability.
4. Run `pnpm run migrate` (the root script delegates to `pnpm stam db migrate`).

![TablePlus exporting an illustrative dogs table schema](../assets/database/tableplus-schema.png)

This screenshot illustrates SQL export, not a complete schema for the model
examples above: its nullable name column must not be copied into a non-nullable model.
