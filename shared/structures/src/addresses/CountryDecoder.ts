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
            case Country.Belgium: return $t(`272f5dee-9f15-4afc-a07f-c6ff32b5d106`);
            case Country.Netherlands: return $t(`74a4ed14-c272-4f5e-bc83-e9a59388e55f`);
            case Country.Luxembourg: return $t(`5d3c6960-1c2c-497b-99db-02523b97c9a6`);
            case Country.France: return $t(`508060d8-566b-460e-9777-a83da38ea554`);
            case Country.Germany: return $t(`262e99c0-5df1-4bfb-b61b-9cc689e74842`);
            case Country.Sweden: return $t(`b3b06f70-4bc6-4d24-8b4e-b819d7d1c681`);
            case Country.UnitedKingdom: return $t(`a2b0ea80-7e65-4951-bdbf-c61f6995338e`);
            case Country.Switzerland: return $t(`d11b4aae-a999-4814-bd4b-be85b4e00598`);
            case Country.Afghanistan: return $t(`978520d9-7210-414a-82fd-9c04697b1a08`);
            case Country.CzechRepublic: return $t(`21c6085b-3ed3-4922-a438-e06364ad70f6`);
            case Country.UnitedStates: return $t(`9d52e8c1-8093-4470-bc3d-5d79f184cee8`);
            case Country.Austria: return $t(`86f87cca-4ed5-40ac-a03d-33a6ffef7466`);
            case Country.Portugal: return $t(`e79825e3-975a-4da9-8425-77beac42a41f`);
            case Country.Other: return $t(`4fd81137-ac48-4bec-b6f1-4fc1b55b7b5d`);
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
