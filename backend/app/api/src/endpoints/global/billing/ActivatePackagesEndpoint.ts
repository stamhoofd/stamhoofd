/* import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { IDRegisterCheckout, RegisterResponse } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = IDRegisterCheckout;
type ResponseBody = RegisterResponse;

export class ActivatePackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/activate-packages', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {

    }
}
*/
