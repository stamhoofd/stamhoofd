import colors from "colors";
import { promises as fs } from "fs";
import path from "path";

import { Migration as MigrationModel } from "../models/Migration";
import { Database } from './Database';

type MigrationFunction = () => Promise<void>;

async function directoryExists(filePath): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isDirectory();
    } catch (err) {
        return false;
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
    static async runAll(folder: string): Promise<boolean> {
        console.log("Running all migrations...")

        // First check if we have migrations table
        const setupMigration = await this.getMigration(__dirname + '/../migrations/000000000-setup-migrations.sql')
        if (!setupMigration) {
            throw new Error("Setup migration missing")
        }
        await setupMigration.up();
        await MigrationModel.markAsExecuted("database/migrations/000000000-setup-migrations.sql");

        const folders = (await fs.readdir(folder, { withFileTypes: true })).filter(dirent => dirent.isDirectory());
        const files: string[] = []

        for (const dirent of folders) {
            const p = folder + "/" + dirent.name + "/migrations";
            if (await directoryExists(p)) {

                const folderFiles = await fs.readdir(p);

                for (const file of folderFiles) {
                    const full = p + "/" + file;
                    const relative = path.relative(__dirname + "/../..", full);
                    if (!(await MigrationModel.isExecuted(relative))) {
                        files.push(full);
                    }
                }
            }
        }

        // Make sure we run the migrations in order
        files.sort((a, b) => {
            // It is expected to return a negative value if first argument is less than second argument, zero if they're equal and a positive value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
            const ab = path.basename(a)
            const bb = path.basename(b)

            if (ab < bb) return -1
            if (ab > bb) return 1
            return 0
        });

        for (const file of files) {
            const relative = path.relative(__dirname + "/../..", file);
            // Check if SQL or TypeScript
            const migration = await this.getMigration(file)
            if (!migration) {
                throw new Error("Invalid migration at " + file)
            }

            process.stdout.write(colors.bold("Migration " + relative));
            try {
                await migration.up();
                await MigrationModel.markAsExecuted(relative);
                process.stdout.write(": " + colors.green("OK") + "\n");
            } catch (e) {
                process.stdout.write(": " + colors.red("FAILED") + "\n");
                process.stderr.write(colors.bold.red("Error: " + e.message + "\n"));
                return false;
            }
        }
        return true;
    }

    static async getMigration(file: string): Promise<Migration | undefined> {
        const relative = path.relative(__dirname + "/../..", file);

        let migration: Migration
        if (relative.endsWith('.sql')) {
            if (relative.endsWith('.down.sql')) {
                // Ignore. This will contain the downgrade implementation.
                return;
            }
            const sqlStatement = await fs.readFile(file, { encoding: "utf-8" });
            const statements = sqlStatement.split(";");

            migration = new Migration(async () => {
                for (const statement of statements) {
                    const trimmed = statement.trim();
                    if (trimmed.length > 0) await Database.statement(trimmed);
                }
            });

        } else {
            const imported = await import(file);
            migration = imported.default;
        }
        return migration
    }
}
