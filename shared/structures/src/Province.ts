import { Country } from './CountryDecoder';


// Belgian + Dutch Provinces (will move to the database in the future)
export enum Province {
    OostVlaanderen = "OostVlaanderen",
    WestVlaanderen = "WestVlaanderen"
}

export class ProvinceHelper {
    static getName(province: Province): string {
        switch(province) {
        case Province.OostVlaanderen: return "Oost-Vlaanderen"
        case Province.WestVlaanderen: return "West-Vlaanderen"
        }
    }

    static getCountry(province: Province): Country {
        switch(province) {
        case Province.OostVlaanderen: return "BE"
        case Province.WestVlaanderen: return "BE"
        }
    }
}