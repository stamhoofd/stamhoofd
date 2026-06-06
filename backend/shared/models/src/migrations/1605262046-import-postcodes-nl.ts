import { Database, Migration } from '@simonbackx/simple-database';
import { Country } from '@stamhoofd/types/Country';
import { StringCompare } from '@stamhoofd/utility';
import fs from 'fs';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

import { City } from '../models/addresses/City.js';
import { PostalCode } from '../models/addresses/PostalCode.js';
import { Province } from '../models/addresses/Province.js';

function getProvince(name: string, provinces: Province[], provinceRows: string[][]): Province {
    const p = provinces.find(p => StringCompare.typoCount(p.name, name) == 0 && p.country == Country.Netherlands);
    if (p) {
        return p;
    }
    const province = new Province();
    province.id = uuidv4();
    province.country = Country.Netherlands;
    province.name = name;

    provinces.push(province);
    provinceRows.push([province.id, province.name, province.country]);
    return province;
}

function getCity(name: string, provinceId: string, citiesByName: Map<string, City>, cityRows: unknown[][]): City {
    const p = citiesByName.get(normalizeCityName(name));
    if (p) {
        return p;
    }
    const city = new City();
    city.id = uuidv4();
    city.name = name;
    city.country = Country.Netherlands;
    city.provinceId = provinceId;
    cityRows.push([city.id, city.name, city.provinceId, city.parentCityId, city.country]);

    citiesByName.set(normalizeCityName(city.name), city);
    return city;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    // We start by looping all provinces in the files
    const folder = import.meta.dirname + '/data/postcodes/nl';
    const provinces = (await fs.promises.readdir(folder, { withFileTypes: true }))
        .filter(dirent => !dirent.isDirectory())
        .map((dirent) => {
            return { path: folder + '/' + dirent.name, name: dirent.name };
        });

    const allProvinces = await Province.where({ country: Country.Netherlands });
    const provinceRows: string[][] = [];
    const cityRows: unknown[][] = [];
    const postalCodeRows: string[][] = [];
    const parentCityUpdates: string[][] = [];

    for (const p of provinces) {
        // console.log(p.name);

        const province = getProvince(p.name.trim(), allProvinces, provinceRows);

        // const cities = await fs.readFile(p.path, { encoding: "utf-8" });

        const lineReader = readline.createInterface({
            input: fs.createReadStream(p.path, { encoding: 'utf-8' }),
        });

        const citiesByName = new Map<string, City>();

        for await (const line of lineReader) {
            const splitted = line.split('\t');
            if (splitted.length !== 3) {
                console.error(`Failed to parse line: ${line}`);
                continue;
            }
            const postcode = splitted[0].trim();
            const gemeente = splitted[1].trim();
            const plaats = splitted[2].trim();

            // Check plaats and gemeente
            const city = getCity(plaats, province.id, citiesByName, cityRows);
            const city2 = getCity(gemeente, province.id, citiesByName, cityRows); // might be the same as city
            if (city2.id !== city.id && city.parentCityId === null) {
                city.parentCityId = city2.id;
                parentCityUpdates.push([city.id, city2.id]);
            }

            // Also add postal code already
            postalCodeRows.push([uuidv4(), postcode, city.id, Country.Netherlands]);
        }
    }

    await insertRows(Province.table, ['id', 'name', 'country'], provinceRows);
    await insertRows(City.table, ['id', 'name', 'provinceId', 'parentCityId', 'country'], cityRows);
    await insertRows(PostalCode.table, ['id', 'postalCode', 'cityId', 'country'], postalCodeRows);
    await updateParentCityIds(parentCityUpdates);
});
function normalizeCityName(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/, ' ').trim();
}

async function insertRows(table: string, columns: string[], rows: unknown[][]): Promise<void> {
    for (const chunk of chunks(rows, 1000)) {
        if (chunk.length === 0) {
            continue;
        }
        await Database.insert(`INSERT INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(', ')}) VALUES ?`, [chunk]);
    }
}

async function updateParentCityIds(rows: string[][]): Promise<void> {
    for (const chunk of chunks(rows, 1000)) {
        if (chunk.length === 0) {
            continue;
        }
        const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
        await Database.statement(`UPDATE \`${City.table}\` SET \`parentCityId\` = CASE \`id\` ${cases} END WHERE \`id\` IN (?)`, [
            ...chunk.flatMap(([cityId, parentCityId]) => [cityId, parentCityId]),
            chunk.map(([cityId]) => cityId),
        ]);
    }
}

function chunks<T>(values: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size));
    }
    return result;
}
