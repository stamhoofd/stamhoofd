import { promises as fs } from "fs"

type MigrationFunction = () => Promise<void>

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

export class Migration {
    up: MigrationFunction
    down: MigrationFunction | undefined

    constructor(up: MigrationFunction, down?: MigrationFunction) {
        this.up = up
        this.down = down
    }

    /// Run migrations in the given folder
    static async run(folder: string) {
        /// Query all migrations
        const files = await fs.readdir(folder);

        await asyncForEach(files, async file => {
            console.log(file);
            const imported = await import(file);
            const migration: Migration = imported.default;
            await migration.up();
        });
    }
}