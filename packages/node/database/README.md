# Simple database

A simple library that helps you perform basic database operations (save, delete...) but gives you the possibility to write your own queries instead of using automated - non optimized - queries.

The idea is to provide a type safe ORM. The problem in most ORMs is that you never know what relation is already loaded and which is not. Simple database will generate compile time errors when a relation is not loaded by using the power of TypeScript.

Again, simplicity also means a bit more boilerplate code. But that will make the code only more customizeable and maintainable in the future.

## Installation

### Yarn

```
yarn add @simonbackx/simple-database
```

### NPM

```
npm install @simonbackx/simple-database
```

## Example

See [Defining and saving models](docs/models.md) for column defaults, change
detection and structures stored in JSON columns.

```ts
type TestModelWithFriends = TestModel & { friends: TestModel[] };

class TestModel extends Model {
    static table = "testModels";

    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    name: string;

    @column({ type: "integer" })
    count: number;

    @column({ type: "boolean" })
    isActive: boolean;

    @column({ type: "datetime" })
    createdOn: Date;

    @column({ type: "date", nullable: true })
    birthDay: Date | null = null;

    @column({ foreignKey: TestModel.partner, type: "integer", nullable: true })
    partnerId: number | null = null; // null = no address

    // Relations are defined as static properties, but you could define them however you like
    static partner = new ManyToOneRelation(TestModel, "partner");
    static friends = new ManyToManyRelation(TestModel, TestModel, "friends");

    static async getWithFriends(id: number): Promise<TestModelWithFriends | undefined> {
        // ... implementation with join here
        // note the type safe return type that indicates that the relation is loaded
    }

    // You can only use this method when the relation 'friends' is loaded
    logFriendCount(this: TestModelWithFriends) {
        console.log("I have " + this.friends.length + " friends");
    }
}
```

A very basic usage example would be the following code. Please note that we could still make some changes to the API to remove some boilerplate code (if possible). We would be able to make this shorter if TypeScript would support type guards on async methods.

```ts
const model = await TestModel.getByID(12);
if (!model) {
    throw new Error("Not found");
}
await TestModel.friends.load(model);
if (TestModel.friends.isLoaded(model)) {
    // model.friends is defined here
    console.log("He has " + model.friends.length + " friends");
    model.logFriendCount();
}

model.logFriendCount(); // will throw a compile error
```

## Multiple databases

Queries that don't receive an explicit connection run on `Database.instance`: the instance built from
the environment variables, unless the async context they run in was given another one.

```ts
const statistics = new DatabaseInstance({ host: "...", database: "statistics" });

// Everything in here - models, queries, migrations - runs on the statistics database
await DatabaseInstance.use(statistics, async () => {
    await Database.instance.select("SELECT * from members");
});
```

Migrations take the database they run on directly, and keep their history in its own `migrations`
table:

```ts
await Migration.runAll(__dirname + "/migrations", { database: statistics });
```

## Running tests

To run tests, make sure you create a .env file first. Setup a test database and run the migrations first.

```
yarn migrations
```

### Example .env file

```
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=root
DB_DATABASE=simple-database-tests
```
