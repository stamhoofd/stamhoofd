import { Migration } from '@simonbackx/simple-database';
import { StringCompare } from '@stamhoofd/utility';
import fs from "fs";
import readline from "readline";
import { Country } from '@stamhoofd/structures';

import { City } from '../models/addresses/City';
import { PostalCode } from '../models/addresses/PostalCode';
import { Province } from '../models/addresses/Province';

async function getProvince(name: string, provinces: Province[]): Promise<Province> {
    const p = provinces.find(p => StringCompare.typoCount(p.name, name) == 0 && p.country == Country.Netherlands)
    if (p) {
        return p
    }
    const province = new Province()
    province.country = Country.Netherlands
    province.name = name
    await province.save()

    provinces.push(province)
    return province
}

async function getCity(name: string, provinceId: string, cities: City[]): Promise<City> {
    const p = cities.find(p => StringCompare.typoCount(p.name, name) == 0 && p.country == Country.Netherlands)
    if (p) {
        return p
    }
    const city = new City()
    city.name = name
    city.country = Country.Netherlands
    city.provinceId = provinceId
    await city.save()

    cities.push(city)
    return city
}

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    // We start by looping all provinces in the files
    const folder = __dirname+"/data/postcodes/nl"
    const provinces = (await fs.promises.readdir(folder, { withFileTypes: true }))
            .filter((dirent) => !dirent.isDirectory())
            .map((dirent) => {
                return { path: folder + "/" + dirent.name, name: dirent.name }
            });

    const allProvinces = await Province.where({ country: Country.Netherlands})

    for (const p of provinces) {
        console.log(p.name);

        const province = await getProvince(p.name.trim(), allProvinces)

        //const cities = await fs.readFile(p.path, { encoding: "utf-8" });

        const lineReader = readline.createInterface({
            input: fs.createReadStream(p.path, { encoding: "utf-8" })
        });

        const cities: City[] = []

        for await (const line of lineReader) {
            const splitted = line.split("\t")
            if (splitted.length != 3) {
                console.error(`Failed to parse line: ${line}`);
                continue;
            }
            const postcode = splitted[0].trim();
            const gemeente = splitted[1].trim();
            const plaats = splitted[2].trim();

            // Check plaats and gemeente
            const city = await getCity(plaats, province.id, cities);
            const city2 = await getCity(gemeente, province.id, cities); // might be the same as city
            if (city2.id != city.id && city.parentCityId === null) {
                city.parentCityId = city2.id
                await city.save()
            }

            // Also add postal code already
            const postalCode = new PostalCode()
            postalCode.postalCode = postcode
            postalCode.cityId = city.id
            postalCode.country = Country.Netherlands
            await postalCode.save();
        }
    }
});


