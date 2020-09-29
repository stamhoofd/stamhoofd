import { Data, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from "@simonbackx/simple-errors"

export type Country = "BE" | "NL"
class CountryDecoderStatic implements Decoder<Country> {
    decode(data: Data): Country {
        const str = data.string.toUpperCase();

        if (str.length != 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Received an invalid country",
                human: "Ongeldige landcode",
                field: data.currentField,
            });
        }

        switch (str) {
        case "BE":
            return str;
        case "NL":
            return str;
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Country not supported",
            human: "Het opgegeven land wordt nog niet ondersteund",
            field: data.currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export const CountryDecoder = new CountryDecoderStatic();

export class CountryHelper {
    static getName(country: Country) {
        switch(country) {
        case "BE": return "België"
        case "NL": return "Nederland"
        }
    }

    static getList() {
        return [
            {
                text: this.getName("BE"),
                value: "BE"
            },
            {
                text: this.getName("NL"),
                value: "NL"
            }
        ]; 
    }
}