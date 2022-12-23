import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { RegisterCode } from '@stamhoofd/models';

type Params = { code: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class CheckRegisterCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/register-code/@code", {code: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        
        const code = await RegisterCode.getByID(request.params.code)
        if (code) {
            return new Response(undefined)
        }

        throw new SimpleError({
            code: "invalid_code",
            message: "Invalid code",
            human: "Deze code is niet geldig",
            field: "registerCode"
        })
    }
}
