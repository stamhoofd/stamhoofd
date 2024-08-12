import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";
import { Address } from "./Address";
import { Country } from './CountryDecoder';

export class Premise extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new ArrayDecoder(StringDecoder)})
    premiseTypeIds: string[] = [];

    @field({ decoder: Address})
    address: Address = Address.createDefault();

    static createDefault(country?: Country): Premise {
        return Premise.create({address: Address.createDefault(country)})
    }
}
