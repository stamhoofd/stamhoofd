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
export type CountryCode = Exclude<Country, Country.Other>;
