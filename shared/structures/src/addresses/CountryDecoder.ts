import { EnumDecoder } from '@simonbackx/simple-encoding';

// The Country enum is also defined in environment.d.ts - they should remain in sync to avoid compilation errors
export enum Country {
    Belgium = 'BE',
    Netherlands = 'NL',
    Luxembourg = 'LU',
    France = 'FR',
    Germany = 'DE',
    Sweden = 'SE',
    UnitedKingdom = 'GB',
    Switzerland = 'CH',
    Afghanistan = 'AF',
    CzechRepublic = 'CZ',
    UnitedStates = 'US',
    Austria = 'AT',
    Portugal = 'PT',
    Other = 'OTHER',
}

// If this throws a type error - then GlobalCountry and Country are not in sync. Update both in environment.d.ts and above.
type ValidateExtends<T, E extends T> = true;
type CountryExtendsGlobalCountry = ValidateExtends<GlobalCountry, Country>;
type GlobalCountryExtendsCountry = ValidateExtends<Country, GlobalCountry>;

export type CountryCode = Exclude<Country, Country.Other>;
export const countryCodes = Object.values(Country).filter(country => country !== Country.Other) as CountryCode[];

export function countryToCode({ country, defaultCountryCode }: { country: Country; defaultCountryCode: CountryCode }): CountryCode {
    if (country === Country.Other) {
        return defaultCountryCode;
    }

    return country;
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export const CountryDecoder = new EnumDecoder(Country);

export class CountryHelper {
    static getName(country: Country): string {
        switch (country) {
            case Country.Belgium: return $t(`%o3`);
            case Country.Netherlands: return $t(`%o4`);
            case Country.Luxembourg: return $t(`%o5`);
            case Country.France: return $t(`%o6`);
            case Country.Germany: return $t(`%o7`);
            case Country.Sweden: return $t(`%o8`);
            case Country.UnitedKingdom: return $t(`%o9`);
            case Country.Switzerland: return $t(`%oA`);
            case Country.Afghanistan: return $t(`%1W`);
            case Country.CzechRepublic: return $t(`%oB`);
            case Country.UnitedStates: return $t(`%oC`);
            case Country.Austria: return $t(`%oD`);
            case Country.Portugal: return $t(`%2O`);
            case Country.Other: return $t(`%oE`);
        }
    }

    static getList() {
        return Object.values(Country).map((country) => {
            return {
                text: this.getName(country),
                value: country,
            };
        });
    }
}
