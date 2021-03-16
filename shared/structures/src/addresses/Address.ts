import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
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

    static createDefault(): Address {
        return Address.create({
            street: "",
            number: "",
            postalCode: "",
            city: "",
            country: "BE"
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
        this.street = this.street.trim()
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

        if (country != "BE" && country != "NL") {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid country",
                human: "Selecteer een land",
                field: "country"
            })
        }

        return Address.create({
            street,
            number,
            postalCode: postalCode,
            city: city,
            country: country
        })
    }

    static splitAddressLine(addressLine1: string) {
        if (addressLine1.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Empty address line 1",
                human: "Vul de straat en huisnummer in"
            })
        }
        // Get position of last letter
        const match = /^\s*([^0-9]+?)[\s,]*([0-9].*?)\s*$/.exec(addressLine1)
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