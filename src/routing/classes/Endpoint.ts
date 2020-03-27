import { Request } from './Request';
import { DecodedRequest } from './DecodedRequest';
import { Response } from './Response';
import { EncodedResponse } from './EncodedResponse';
import { Decoder } from '../../structs/classes/Decoder';
import { Encodeable } from '../../structs/classes/Encodeable';
import { ObjectData } from '../../structs/classes/ObjectData';
import { Data } from '../../structs/classes/Data';

export abstract class Endpoint
    <
    Params,
    Query,
    RequestBody,
    ResponseBody extends Encodeable
    > {

    protected queryDecoder: Decoder<Query> | undefined
    protected bodyDecoder: Decoder<RequestBody> | undefined

    protected abstract doesMatch(request: Request): [true, Params] | [false]
    protected abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Promise<Response<ResponseBody>>

    async getResponse(request: Request, params: Params): Promise<Response<ResponseBody>> {
        const decodedRequest = new DecodedRequest<Params, Query, RequestBody>(request, params as Params, this.queryDecoder, this.bodyDecoder)
        return await this.handle(decodedRequest)
    }

    async run(request: Request): Promise<EncodedResponse | null> {
        const [match, params] = this.doesMatch(request)
        if (match) {
            return new EncodedResponse(await this.getResponse(request, params as Params))
        }
        return null;
    }

    static parseParameters<Keys extends string>(url: string, template: string, params: Record<Keys, NumberConstructor | StringConstructor>): Record<Keys, number | string> | undefined {
        const parts = url.split('/');
        const templateParts = template.split('/');

        if (parts.length != templateParts.length) {
            // No match
            return
        }

        let resultParams = {} as any

        for (let index = 0; index < parts.length; index++) {
            const part = parts[index]

            const templatePart = templateParts[index]
            if (templatePart != part) {
                const param = templatePart.substr(1)
                if (params[param]) {
                    // Found a param
                    resultParams[param] = params[param](part)
                    continue
                }
                // no match
                return
            }
        }

        return resultParams
    }
}
