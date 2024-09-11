import fs from "fs/promises";

const msIn22Hours = 79200000;
let lastExcelClear: number | null = null;

export async function clearExcelCache() {
    const now = new Date();

    const didClear = await clearExcelCacheHelper({
        lastExcelClear,
        now,
        cachePath: STAMHOOFD.CACHE_PATH,
        environment: STAMHOOFD.environment
    });

    if(didClear) {
        lastExcelClear = now.getTime();
    }
}

export async function clearExcelCacheHelper
({lastExcelClear, now, cachePath, environment}: {lastExcelClear: number | null, now: Date, cachePath: string, environment: "production" | "development" | "staging" | "test"}): Promise<boolean> {
    if (environment === "development") {
        return false;
    }

    const hour = now.getHours();

    // between 3 and 6 AM
    if(hour < 3 || hour > 5) {
        return false;
    }

    // only run once each day
    if(lastExcelClear !== null && lastExcelClear + msIn22Hours > now.getTime()) {
        return false;
    }

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const maxDaysInCache = 2;

    const dateLimit = new Date(currentYear, currentMonth, currentDay - maxDaysInCache, 0,0,0,0);

    const files = await fs.readdir(cachePath, {withFileTypes: true});

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

    return true;
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
