import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

export function clearExcelCache() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const maxDaysInCache = 2;
    const dir: string = STAMHOOFD.CACHE_PATH;

    const dateLimit = new Date(currentYear, currentMonth, currentDay - maxDaysInCache, 0,0,0,0);

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            try {
                const date = getDateFromDirectoryName(file);
                const shouldDelete = date < dateLimit;

                if(shouldDelete) {
                    deleteDirectory(filePath);
                }
            } catch(error) {
                console.error(error);
            }
        }
    }
    
}

function getDateFromDirectoryName(file: string): Date {
    const parts = file.split('-');

    if (parts.length != 3) {
        throw new Error(`Invalid directory ${file} in cache.`);
    }

    const year = parseInt(parts[0]);
    if(isNaN(year)) {
        throw new Error(`Year is NAN for directory ${file} in cache.`);
    }

    const month = parseInt(parts[1]);
    if(isNaN(month)) {
        throw new Error(`Month is NAN for directory ${file} in cache.`);
    }

    const day = parseInt(parts[2]);
    if(isNaN(day)) {
        throw new Error(`Day is NAN for directory ${file} in cache.`);
    }

    return new Date(year, month - 1, day);
}

function deleteDirectory(path: fs.PathLike) {
    fsPromises.rm(path, { recursive: true, force: true })
        .then(() => console.log("Removed", path))
        .catch(console.error)
}
