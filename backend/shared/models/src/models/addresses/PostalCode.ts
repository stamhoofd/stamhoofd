import { column, Database, ManyToOneRelation } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import { Country } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { City } from './City';

export class PostalCode extends QueryableModel {
    static table = 'postal_codes';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    postalCode: string;

    @column({ type: 'string', foreignKey: PostalCode.city })
    cityId: string;

    @column({ type: 'string' })
    country: Country;

    static city = new ManyToOneRelation(City, 'city');

    /**
     * Search for a given city via it's postal code and country, collecting information about the city (id), parentCity (id) and province (id)
     */
    static async getCity(postalCode: string, cityName: string, country: Country): Promise<City | null> {
        let query = `SELECT ${City.getDefaultSelect()}from \`${PostalCode.table}\`\n`;
        query += `JOIN \`${City.table}\` ON \`${PostalCode.table}\`.\`${PostalCode.city.foreignKey}\` = \`${City.table}\`.\`${City.primary.name}\`\n`;

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${PostalCode.table}\`.\`postalCode\` = ? AND \`${PostalCode.table}\`.\`country\` = ?`;

        const [results] = await Database.select(query, [postalCode, country]);

        const cities = City.fromRows(results, City.table);

        if (cities.length == 1) {
            return cities[0];
        }

        // Search by city name (first exact match, then allow errors)
        let bestScore = 0;
        let bestCity: City | null = null;

        for (const city of cities) {
            const typo = StringCompare.typoCount(cityName, city.name);
            if (typo == 0) {
                return city;
            }

            if (bestCity === null || typo < bestScore) {
                bestCity = city;
                bestScore = typo;
            }
        }

        if (bestCity && (bestScore < 3 || StringCompare.contains(cityName, bestCity.name) || StringCompare.contains(bestCity.name, cityName))) {
            return bestCity;
        }

        bestScore = 0;
        bestCity = null;

        for (const city of cities) {
            const match = StringCompare.matchCount(cityName, city.name);

            if (bestCity === null || match > bestScore) {
                bestCity = city;
                bestScore = match;
            }
        }

        if (bestCity && (bestScore > cityName.length / 2 || StringCompare.contains(cityName, bestCity.name))) {
            return bestCity;
        }

        if (cities.length >= 1 && cities[0].parentCityId !== null && cities.every(c => c.parentCityId === cities[0].parentCityId)) {
            // Might have put a postal code of the parent city
            const parent = await City.getByID(cities[0].parentCityId);
            if (parent) {
                const typo = StringCompare.typoCount(cityName, parent.name);
                if (typo < 4 || StringCompare.contains(cityName, parent.name)) {
                    if (cities.length > 1) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid city. Suggestions: ' + Formatter.joinLast(cities.map(c => c.name), ', ', ' of ') + '?',
                            human: $t(`Welke gemeente bedoel je precies?`) + ' ' + Formatter.joinLast(cities.map(c => c.name), ', ', ' ' + $t(`of`) + ' ') + '?',
                            field: 'city',
                        });
                    }
                    return cities[0]; // do not return parent here, because the postal code has priority
                }
            }
        }

        // Search parent in belgium only
        if (country == Country.Belgium) {
            return this.getCityByParent(postalCode, cityName, country);
        }

        return null;
    }

    /**
     * Search for a given city via it's postal code and country, collecting information about the city (id), parentCity (id) and province (id)
     */
    static async getCityByParent(postalCode: string, cityName: string, country: Country): Promise<City | null> {
        let query = `SELECT ${City.getDefaultSelect()}from \`${PostalCode.table}\`\n`;
        query += `JOIN \`${City.table}\` as parent ON \`${PostalCode.table}\`.\`${PostalCode.city.foreignKey}\` = \`parent\`.\`${City.primary.name}\`\n`;
        query += `JOIN \`${City.table}\` ON \`parent\`.\`${City.primary.name}\` = \`${City.table}\`.\`${City.parentCity.foreignKey}\`\n`;

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${PostalCode.table}\`.\`postalCode\` = ? AND \`${PostalCode.table}\`.\`country\` = ?`;

        const [results] = await Database.select(query, [postalCode, country]);

        const cities = City.fromRows(results, City.table);

        // Search by city name (first exact match, then allow errors)
        let bestScore = 0;
        let bestCity: City | null = null;

        for (const city of cities) {
            const typo = StringCompare.typoCount(cityName, city.name);
            if (typo == 0) {
                return city;
            }

            if (bestCity === null || typo < bestScore) {
                bestCity = city;
                bestScore = typo;
            }
        }

        if (bestCity && (bestScore < 3 || StringCompare.contains(cityName, bestCity.name) || StringCompare.contains(bestCity.name, cityName))) {
            return bestCity;
        }

        bestScore = 0;
        bestCity = null;

        for (const city of cities) {
            const match = StringCompare.matchCount(cityName, city.name);

            if (bestCity === null || match > bestScore) {
                bestCity = city;
                bestScore = match;
            }
        }

        if (bestCity && (bestScore > cityName.length / 2 || StringCompare.contains(cityName, bestCity.name))) {
            return bestCity;
        }

        return null;
    }
}
