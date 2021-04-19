import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Address, ValidatedAddress } from "@stamhoofd/structures";

import { PostalCode } from '@stamhoofd/models';

type Params = {};
type Query = undefined;
type Body = Address
type ResponseBody = ValidatedAddress;

export class ValidateAddressEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Address as Decoder<Address>
    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/address/validate", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        let postalCode = request.body.postalCode
        if (request.body.country == "NL") {
            // Check if we have the right syntax
            const stripped = postalCode.replace(/\s/g, '')
            if (stripped.length != 6) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postal code format (NL)",
                    human: "Ongeldig postcode formaat, voer in zoals '8011 PK'",
                    field: "postalCode"
                })
            }

            const numbers = stripped.slice(0, 4)
            if (!/[0-9]{4}/.test(numbers)) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid postal code format (NL)",
                    human: "Ongeldig postcode formaat, voer in zoals '8011 PK'",
                    field: "postalCode"
                })
            }

            // Don't do validation on last letters
            postalCode = numbers
        }


        const city = await PostalCode.getCity(postalCode, request.body.city, request.body.country)

        if (!city) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid postal code or city",
                human: "Deze postcode en/of gemeente bestaat niet, kijk je even na op een typfout?",
                field: "postalCode"
            })
        }

        const validated = ValidatedAddress.create(Object.assign({ ... request.body }, {
            city: city.name, // override misspelled addresses
            cityId: city.id,
            parentCityId: city.parentCityId,
            provinceId: city.provinceId,
        }))
        
        return new Response(validated);
    }
}
