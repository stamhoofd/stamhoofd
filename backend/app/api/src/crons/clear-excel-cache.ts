import fs from "fs/promises";

export async function clearExcelCache() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const maxDaysInCache = 2;
    const dir: string = STAMHOOFD.CACHE_PATH;

    const dateLimit = new Date(currentYear, currentMonth, currentDay - maxDaysInCache, 0,0,0,0);

    const files = await fs.readdir(dir, {withFileTypes: true});

    for (const file of files) {
        if (file.isDirectory()) {
            try {
                const date = getDateFromDirectoryName(file.name);
                const shouldDelete = date < dateLimit;

                if(shouldDelete) {
                    const path = file.path + '/' + file.name;
                    await fs.rm(path, { recursive: true, force: true })
                    console.log("Removed", path)
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
