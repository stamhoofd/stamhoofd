import { AutoEncoder, field, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter,StringCompare } from '@stamhoofd/utility';

import { Country, CountryDecoder, CountryHelper } from './CountryDecoder';

export class Address extends AutoEncoder {
    @field({ decoder: StringDecoder })
    street: string;

    @field({ decoder: StringDecoder })
    number: string;

    @field({ decoder: StringDecoder })
    postalCode: string;

    @field({ decoder: StringDecoder })
    city: string;

    @field({ decoder: CountryDecoder })
    country: Country;

    toString(): string {
        return this.street + " " + this.number + ", " + this.postalCode + " " + this.city + ", " + CountryHelper.getName(this.country)
    }

    shortString(): string {
        return this.street + " " + this.number + ", " + this.city
    }

    cityString(currentCountry: string): string {
        if (this.country == currentCountry) {
            return this.city
        }
        return this.city + ", " + CountryHelper.getName(this.country)
    }

    anonymousString(currentCountry: string): string {
        if (this.country == currentCountry) {
            return this.street + ', ' + this.city
        }
        return this.street + ', ' + this.city + " (" + CountryHelper.getName(this.country)+")"
    }

    static createDefault(country = Country.Belgium): Address {
        return Address.create({
            street: "",
            number: "",
            postalCode: "",
            city: "",
            country
        })
    }

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData(): void {
        if (StringCompare.isFullCaps(this.street)) {
            this.street = Formatter.capitalizeWords(this.street.toLowerCase())
        }

        if (StringCompare.isFullCaps(this.city)) {
            this.city = Formatter.capitalizeWords(this.city.toLowerCase())
        }

        this.number = this.number.trim()
        this.street = Formatter.capitalizeFirstLetter(this.street.trim())
        this.city = Formatter.capitalizeFirstLetter(this.city.trim())
        this.postalCode = this.postalCode.trim().toLocaleUpperCase()
    }

    static createFromFields(addressLine1: string, postalCode: string, city: string, country: string): Address {
        const { street, number } = Address.splitAddressLine(addressLine1)

        if (postalCode.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Empty postalcode",
                human: "Vul de postcode in"
            })
        }

        if (city.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Empty city",
                human: "Vul de gemeente in"
            })
        }

        let c: Country;

        try {
            c = CountryDecoder.decode(new ObjectData(country, { version: 0 }))
        } catch (e) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid country",
                human: "Selecteer een land",
                field: "country"
            })
        }

        city = city.trim();
        if (city.match(/[0-9]/)) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid city",
                human: "De gemeente mag geen cijfers bevatten.",
                field: "city"
            })
        }

        if (c === Country.Belgium) {
            postalCode = postalCode.trim();
            if (postalCode.length !== 4 || !postalCode.match(/^[0-9]+$/)) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postalCode",
                    human: "Ongeldige postcode. Een postcode moet uit 4 cijfers bestaan.",
                    field: "postalCode"
                })
            }
        }

        if (c === Country.Netherlands) {
            postalCode = postalCode.trim();
            const firstFour = postalCode.substring(0, 4);
            const remaining = postalCode.substring(4).trim().toLocaleUpperCase();

            if (firstFour.length !== 4 || !firstFour.match(/^[0-9]+$/) || remaining.length !== 2 || !remaining.match(/^[A-Z]+$/) ) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postalCode",
                    human: "Ongeldige postcode. Een postcode moet beginnen met 4 cijfers en eindigen op 2 letters, bv. 9000 AB",
                    field: "postalCode"
                })
            }

            postalCode = firstFour + ' ' + remaining;
        }

        const address = Address.create({
            street,
            number,
            postalCode: postalCode,
            city: city,
            country: c
        })
        address.cleanData()

        return address;
    }

    static splitAddressLine(addressLine1: string) {
        if (addressLine1.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Empty address line 1",
                human: "Vul de straat en huisnummer in"
            })
        }

        if (addressLine1.includes(',')) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Empty address line 1",
                human: "De straat bevat een komma. Verwijder die uit het adres en kijk na of het wel correct werd ingevuld."
            })
        }
        // Get position of last letter
        const match = /^\s*([^0-9\s][^0-9]+?)[\s,]+([0-9].*?)\s*$/.exec(addressLine1)
        if (!match) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Missing number in address line 1",
                human: "Het huisnummer ontbreekt in het opgegeven adres"
            })
        }
        const number = match[2]
        const street = match[1]

        return {
            number,
            street
        }
    }
}

export class ValidatedAddress extends Address {
    @field({ decoder: StringDecoder })
    cityId: string;

    @field({ decoder: StringDecoder, nullable: true })
    parentCityId: string | null;

    @field({ decoder: StringDecoder })
    provinceId: string;
}