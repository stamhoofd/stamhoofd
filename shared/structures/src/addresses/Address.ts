import { AutoEncoder, field, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Country } from '@stamhoofd/types/Country';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { CountryDecoder, CountryHelper } from './CountryDecoder.js';

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
                human: $t(`%no`),
            });
        }

        if (city.length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty city',
                human: $t(`%np`),
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
                human: $t(`%nq`),
                field: 'country',
            });
        }

        city = city.trim();
        if (city.match(/[0-9]/)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid city',
                human: $t(`%nr`),
                field: 'city',
            });
        }

        if (c === Country.Belgium) {
            postalCode = postalCode.trim();
            if (postalCode.length !== 4 || !postalCode.match(/^[0-9]+$/)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid postalCode',
                    human: $t(`%ns`),
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
                    human: $t(`%nt`),
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
                human: $t(`%nu`),
            });
        }

        if (addressLine1.includes(',')) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty address line 1',
                human: $t(`%nv`),
            });
        }

        if (addressLine1.length > 500) {
            // Helps with DoS attacks on the Regex
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty address line 1',
                human: $t(`%nw`),
            });
        }

        // Get position of last letter
        const match = /^\s*([^0-9\s][^0-9]+?)[\s,]+([0-9].*?)\s*$/.exec(addressLine1);
        if (!match) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing number in address line 1',
                human: $t(`%nx`),
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
                human: $t(`%ny`),
            });
        }

        if (this.number.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty number',
                human: $t(`%nz`),
            });
        }

        if (this.postalCode.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty postal code',
                human: $t(`%o0`),
            });
        }

        if (this.city.trim().length == 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty city',
                human: $t(`%o1`),
            });
        }

        if (this.country == null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty country',
                human: $t(`%o2`),
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
