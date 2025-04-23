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
            case Country.Belgium: return $t(`België`);
            case Country.Netherlands: return $t(`Nederland`);
            case Country.Luxembourg: return $t(`Luxemburg`);
            case Country.France: return $t(`Frankrijk`);
            case Country.Germany: return $t(`Duitsland`);
            case Country.Sweden: return $t(`Zweden`);
            case Country.UnitedKingdom: return $t(`Verenigd Koninkrijk`);
            case Country.Switzerland: return $t(`Zwitserland`);
            case Country.Afghanistan: return $t(`Afghanistan`);
            case Country.CzechRepublic: return $t(`Tsjechië`);
            case Country.UnitedStates: return $t(`Verenigde Staten`);
            case Country.Austria: return $t(`Oostenrijk`);
            case Country.Portugal: return $t(`Portugal`);
            case Country.Other: return $t(`Ander land`);
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
