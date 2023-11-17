import { SimpleError } from "@simonbackx/simple-errors";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { Address, Country, CountryHelper } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { GeneralMatcher } from "./GeneralMatcher";

export class TextColumnMatcher extends GeneralMatcher<string> {
    parse(v: string, current: string | undefined): string {
        return v || current || '';
    }
}


export class AddressColumnMatcher extends GeneralMatcher<Address> {
    parse(v: string, current: Address | undefined): Address {
        // Try to parse the address in some ways

        // General structure:
        // Street number, postal code city, country
        // Street number, postal code city

        const split = v.split(',')
        if (split.length === 1) {
            throw new SimpleError({
                code: "invalid_type",
                message: v + ' kon niet als een adres worden herkend. Controleer of het formaat "Straatnaam huisnummer, postcode stad" werd gevolgd.',
            })
        }

        const addressLine1 = split[0].trim()
        const postalCode = split[1].trim().split(' ')[0].trim()
        const city = split[1].trim().split(' ').slice(1).join(' ').trim()

        const countryString = split[2]?.trim() ?? I18nController.shared?.country ?? current?.country ?? Country.Belgium

        // Find best matching country
        let country: Country | undefined
        for (const c of Object.values(Country)) {
            const name = CountryHelper.getName(c)
            if (Formatter.slug(name) === Formatter.slug(countryString) || Formatter.slug(name) === Formatter.slug(c)) {
                country = c
                break
            }
        }

        if (!country) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Onleesbaar adres, mogelijks onbekend land: " + countryString,
                field: "country"
            })
        }

        return Address.createFromFields(addressLine1, postalCode, city, country);
    }
}
