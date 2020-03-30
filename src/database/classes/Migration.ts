import { promises as fs } from "fs";
import { Migration as MigrationModel } from "../models/Migration";
import path from "path";

type MigrationFunction = () => Promise<void>;

async function directoryExists(filePath): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isDirectory();
    } catch (err) {
        return false;
    }
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

export class Migration {
    up: MigrationFunction;
    down: MigrationFunction | undefined;

    constructor(up: MigrationFunction, down?: MigrationFunction) {
        this.up = up;
        this.down = down;
    }

    /***
     * Given a folder, loop all the folders in that folder and run the migrations in the 'migrations' folder
     */
    static async runAll(folder: string) {
        const folders = (await fs.readdir(folder, { withFileTypes: true })).filter(dirent => dirent.isDirectory());

        await asyncForEach(folders, async dirent => {
            const p = folder + "/" + dirent.name + "/migrations";
            if (await directoryExists(p)) {
                console.log("Migrations from " + dirent.name);
                await this.run(p);
            }
        });
    }

    /// Run migrations in the given folder
    static async run(folder: string) {
        /// Query all migrations
        const files = await fs.readdir(folder);

        await asyncForEach(files, async file => {
            const p = folder + "/" + file;
            const relative = path.relative(__dirname + "/../..", p);
            if (!(await MigrationModel.isExecuted(relative))) {
                const imported = await import(p);
                const migration: Migration = imported.default;
                await migration.up();
                await MigrationModel.markAsExecuted(relative);
            }
        });
    }
}
