import { AutoEncoder, field, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { Country, CountryDecoder, CountryHelper } from './CountryDecoder.js';

export class Address extends AutoEncoder {
    get id() {
        return this.street + ' ' + this.number + ', ' + this.postalCode + ' ' + this.city + ', ' + this.country;
    }

    static patchIdentifier() {
        return StringDecoder;
    }

    @field({ decoder: StringDecoder })
    street = '';

    @field({ decoder: StringDecoder })
    number = '';

    @field({ decoder: StringDecoder })
    postalCode = '';

    @field({ decoder: StringDecoder })
    city = '';

    @field({ decoder: CountryDecoder, defaultValue: () => $getCountry() })
    country: Country;

    toString(): string {
        return this.street + ' ' + this.number + ', ' + this.postalCode + ' ' + this.city + ', ' + CountryHelper.getName(this.country);
    }

    shortString(): string {
        return this.street + ' ' + this.number + ', ' + this.city;
    }

    getDiffName() {
        return this.shortString();
    }

    anonymousString(currentCountry: Country = $getCountry()): string {
        if (this.country === currentCountry) {
            return this.street + ', ' + this.city;
        }
        return this.street + ', ' + this.city + ' (' + CountryHelper.getName(this.country) + ')';
    }

    equals(other: Address) {
        return this.toString() === other.toString();
    }

    /**
     * @deprecated
     * Use .create({}) instead
     */
    static createDefault(country: Country = $getCountry()): Address {
        return Address.create({
            street: '',
            number: '',
            postalCode: '',
            city: '',
            country,
        });
    }

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData(): void {
        if (StringCompare.isFullCaps(this.street)) {
            this.street = Formatter.capitalizeWords(this.street.toLowerCase());
        }

        if (StringCompare.isFullCaps(this.city)) {
            this.city = Formatter.capitalizeWords(this.city.toLowerCase());
        }

        this.number = this.number.trim();
        this.street = Formatter.capitalizeFirstLetter(this.street.trim());
        this.city = Formatter.capitalizeFirstLetter(this.city.trim());
        this.postalCode = this.postalCode.trim().toLocaleUpperCase();
    }

    static createFromFields(addressLine1: string, postalCode: string, city: string, country: string): Address {
        const { street, number } = Address.splitAddressLine(addressLine1);

        if (postalCode.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty postalcode',
                human: $t(`50da2518-06f4-47fc-bff7-9d32b941b390`),
            });
        }

        if (city.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty city',
                human: $t(`f4e3da0a-175d-4054-9a66-b5661a5a10cc`),
            });
        }

        let c: Country;

        try {
            c = CountryDecoder.decode(new ObjectData(country, { version: 0 }));
        }
        catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid country',
                human: $t(`6e880cc3-2426-4762-b47e-d6e8d09bab4e`),
                field: 'country',
            });
        }

        city = city.trim();
        if (city.match(/[0-9]/)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid city',
                human: $t(`c67c604b-31ed-4f5a-93b4-a792e76609f5`),
                field: 'city',
            });
        }

        if (c === Country.Belgium) {
            postalCode = postalCode.trim();
            if (postalCode.length !== 4 || !postalCode.match(/^[0-9]+$/)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid postalCode',
                    human: $t(`5d001500-b83d-41dd-9fe3-d4fc12f59983`),
                    field: 'postalCode',
                });
            }
        }

        if (c === Country.Netherlands) {
            postalCode = postalCode.trim();
            const firstFour = postalCode.substring(0, 4);
            const remaining = postalCode.substring(4).trim().toLocaleUpperCase();

            if (firstFour.length !== 4 || !firstFour.match(/^[0-9]+$/) || remaining.length !== 2 || !remaining.match(/^[A-Z]+$/)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid postalCode',
                    human: $t(`ce7f1bc7-64b5-4fc7-ad10-4e01c3bf4962`),
                    field: 'postalCode',
                });
            }

            postalCode = firstFour + ' ' + remaining;
        }

        const address = Address.create({
            street,
            number,
            postalCode: postalCode,
            city: city,
            country: c,
        });
        address.cleanData();

        return address;
    }

    static splitAddressLine(addressLine1: string) {
        if (addressLine1.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty address line 1',
                human: $t(`a77eb9b0-cdda-46af-8970-2d9a6577e4cb`),
            });
        }

        if (addressLine1.includes(',')) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty address line 1',
                human: $t(`576d500a-f6d3-435a-8280-14926f1333f7`),
            });
        }

        if (addressLine1.length > 500) {
            // Helps with DoS attacks on the Regex
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty address line 1',
                human: $t(`14b43fee-f3bc-45cd-a0db-098805ffda04`),
            });
        }

        // Get position of last letter
        const match = /^\s*([^0-9\s][^0-9]+?)[\s,]+([0-9].*?)\s*$/.exec(addressLine1);
        if (!match) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing number in address line 1',
                human: $t(`d6326bee-02b2-4983-a7f4-c33a38435cff`),
            });
        }
        const number = match[2];
        const street = match[1];

        return {
            number,
            street,
        };
    }

    throwIfIncomplete() {
        if (this.street.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty street',
                human: $t(`4953622b-9b0c-49c3-92b9-f5e2532c4c74`),
            });
        }

        if (this.number.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty number',
                human: $t(`248a13b9-7b54-43ab-ac26-974dda1992f1`),
            });
        }

        if (this.postalCode.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty postal code',
                human: $t(`b01c196c-a07b-45a7-af35-caef9fd237ac`),
            });
        }

        if (this.city.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty city',
                human: $t(`7ab64023-08e1-46b1-be6e-4dd8591ff562`),
            });
        }

        if (this.country == null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty country',
                human: $t(`5dac2dd1-1008-4d47-aecc-dba26819d2ae`),
            });
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
