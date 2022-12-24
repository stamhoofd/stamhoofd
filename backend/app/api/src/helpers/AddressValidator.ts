import { Database } from "@simonbackx/simple-database"
import { ArrayDecoder, AutoEncoder, Decoder, field, ObjectData, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { City, PostalCode, Street } from "@stamhoofd/models"
import { Address, Country, ValidatedAddress } from "@stamhoofd/structures"
import { sleep, StringCompare } from "@stamhoofd/utility"
import axios from "axios"
import { v4 as uuidv4 } from "uuid";

export class AddressValidatorStatic {
    // TODO: hold street cache
    
    async validate(address: Address): Promise<ValidatedAddress> {
        address = address.clone()
        let postalCode = address.postalCode
        if (address.country == Country.Netherlands) {
            // Check if we have the right syntax
            const stripped = postalCode.replace(/\s/g, '')
            if (stripped.length != 6) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postal code format (NL)",
                    human: "Ongeldig postcode formaat, voer in zoals '8011 PK'",
                    field: "postalCode"
                })
            }

            const numbers = stripped.slice(0, 4)
            if (!/[0-9]{4}/.test(numbers)) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postal code format (NL)",
                    human: "Ongeldig postcode formaat, voer in zoals '8011 PK'",
                    field: "postalCode"
                })
            }

            // Don't do validation on last letters
            postalCode = numbers
        } else {
            postalCode = postalCode.trim()
        }

        if (postalCode.length == 0) {
            const numbers = address.city.substring(0, 4)
            if (!/[0-9]{4}/.test(numbers)) {
                postalCode = numbers
                address.city = address.city.substring(4).trim()
            } else {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Postal code is required",
                    human: "Voer een postcode in",
                    field: "postalCode"
                })
            }
        }
        
        const city = await PostalCode.getCity(postalCode, address.city, address.country)

        if (!city) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid postal code or city",
                human: "Deze postcode en/of gemeente bestaat niet, kijk je even na op een typfout?",
                field: "postalCode"
            })
        }

        // Validate street and try to correct it
        if (address.country === Country.Belgium) {
            // Also validate the street
            let streets = await Street.where({ cityId: city.parentCityId ?? city.id })

            if (streets.length == 0 && STAMHOOFD.environment === "development") {
                console.log("Forcing sync of city")
                const c = await City.getByID(city.parentCityId ?? city.id)
                try {
                    await this.syncCity(c!)
                } catch (e) {
                    console.error('Ignored error while syncing city')
                    console.error(e)
                }
                streets = await Street.where({ cityId: city.parentCityId ?? city.id })
            }

            if (STAMHOOFD.environment === "development" && streets.length > 0) {
                // First search by typo count
                let bestScore = 0
                let bestStreet: Street | undefined = undefined
                for (const street of streets) {
                    const score = StringCompare.typoCount(street.name, address.street)
                    if ((bestStreet === undefined || score < bestScore)) {
                        bestScore = score
                        bestStreet = street
                    }
                }

                if (bestStreet && bestScore < 3) {
                    address.street = bestStreet.name
                } else {
                    // Search for the street
                    bestScore = 0
                    bestStreet = undefined
                    for (const street of streets) {
                        const score = StringCompare.compare(street.name, address.street)
                        if ((bestStreet === undefined || score > bestScore)) {
                            bestScore = score
                            bestStreet = street
                        }
                    }

                    if (!bestStreet || bestScore < 3 || bestScore < bestStreet.name.length/3) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Invalid street",
                            human: "Deze straat bestaat niet, kijk je deze even na op fouten? Formuleer de naam zonder afkortingen.",
                            field: "street"
                        })
                    }

                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid street, do you mean " + bestStreet.name + "?",
                        human: "Deze straat bestaat niet, bedoel je '" + bestStreet.name + "'?",
                        field: "street"
                    })
                }
            } else {
                // Skip validation for some regions that don't support validation
            }
        }

        return ValidatedAddress.create(Object.assign({ ... address }, {
            postalCode: address.country === Country.Belgium ? postalCode : address.postalCode,
            city: city.name, // override misspelled addresses
            cityId: city.id,
            parentCityId: city.parentCityId,
            provinceId: city.provinceId,
        }))
    }

    async downloadStreets(country: Country, city: string): Promise<string[]> {
        let url: string | undefined = "https://api.basisregisters.vlaanderen.be/v2/straatnamen?gemeentenaam=" + encodeURIComponent(city)
        const streetNames: string[] = []

        try {
            while (url) {
                const response = await axios.request({
                    method: "GET",
                    url,
                    headers: {
                        "Accept": "application/ld+json",
                    }
                })

                // TypeScript is going insane here, hence the weird type casting
                const result = new ObjectData(response.data, { version: 0 }).decode(StraatnamenResult as Decoder<StraatnamenResult>) as any as StraatnamenResult;
                const streets = result.straatnamen.map(street => street.straatnaam.geografischeNaam.spelling);

                streetNames.push(...streets);
                url = result.volgende
            }
            
        } catch (e) {
            console.error(e.response.data)
            throw new Error("Failed to fetch streets")
        }

        return streetNames
    }

    async syncCity(city: City): Promise<void> {
        const streetNames = await this.downloadStreets(city.country, city.name)
        if (streetNames.length == 0) {
            return
        }
        
        await Database.delete("DELETE from `streets` WHERE `cityId` = ?", [city.id])
        await Database.insert("INSERT INTO `streets` (`id`, `name`, `cityId`) VALUES ?", [streetNames.map(street => [uuidv4(), street, city.id])])
    }

    async syncAll(): Promise<void> {
        const cities = await City.where({ country: Country.Belgium, parentCityId: null })
        for (const city of cities) {
            await this.syncCity(city)

            // Rate limit
            await sleep(1000)
        }
    }

    getSlowSync(): () => Promise<void> {
        let lastFullCitySync: Date | null = null
        let lastCityId = ""
        async function syncNext() {
            // Wait 24 hours between every full update
            if (lastFullCitySync && lastFullCitySync > new Date(new Date().getTime() - 24 * 60 * 60 * 1000)) {
                console.log("Skip city sync")
                return
            }
            
            const cities = await City.where({ 
                id: { sign: '>', value: lastCityId },
                country: Country.Belgium, 
                parentCityId: null
            }, {
                limit: 1,
                sort: ["id"]
            })

            if (cities.length == 0) {
                // Wait an half hour before starting again
                lastCityId = ""
                lastFullCitySync = new Date()
                return
            }

            for (const city of cities) {
                try {
                    await this.syncCity(city)
                } catch (e) {
                    console.error("Failed city sync for "+city.name, e)
                }
            }

            lastCityId = cities[cities.length - 1].id
        }

        return syncNext
    }
}
class GeografischeNaam extends AutoEncoder {
    @field({ decoder: StringDecoder })
    spelling: string
}

class Straatnaam extends AutoEncoder {
    @field({ decoder: GeografischeNaam })
    geografischeNaam: GeografischeNaam
}

class StraatnaamResult extends AutoEncoder {
    @field({ decoder: Straatnaam })
    straatnaam: Straatnaam
}

class StraatnamenResult extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StraatnaamResult) })
    straatnamen: StraatnaamResult[]

    @field({ decoder: StringDecoder, optional: true })
    volgende?: string
}

export const AddressValidator = new AddressValidatorStatic()