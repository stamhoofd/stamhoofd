import { EnumDecoder } from '@simonbackx/simple-encoding';

export enum Country {
    Belgium = "BE",
    Netherlands = "NL",
    Luxembourg = "LU",
    France = "FR",
    Germany = "DE"
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export const CountryDecoder = new EnumDecoder(Country);

export class CountryHelper {
    static getName(country: Country): string {
        switch(country) {
        case Country.Belgium: return "België"
        case Country.Netherlands: return "Nederland"
        case Country.Luxembourg: return "Luxemburg"
        case Country.France: return "Frankrijk"
        case Country.Germany: return "Duitsland"
        }
    }

    static getList() {
        return Object.values(Country).map(country => {
            return {
                text: this.getName(country),
                value: country
            }
        })
    }
}