import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Address, ValidatedAddress } from "@stamhoofd/structures";

import { AddressValidator } from '../../../helpers/AddressValidator';

type Params = Record<string, never>;
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
        return new Response(await AddressValidator.validate(request.body));
    }
}
