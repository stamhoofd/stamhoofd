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

    protected query: Decoder<Query> | undefined
    protected requestBody: Decoder<RequestBody> | undefined

    protected abstract doesMatch(request: Request): [true, Params] | [false]
    protected abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Promise<Response<ResponseBody>>

    async run(request: Request): Promise<EncodedResponse | null> {
        const [match, params] = this.doesMatch(request)
        if (match) {
            const query = this.query !== undefined ? this.query.decode(new ObjectData(request.query)) : undefined;
            const requestBody = this.requestBody !== undefined ? this.requestBody.decode(new ObjectData(JSON.parse(request.body))) : undefined;
            const decodedRequest = new DecodedRequest<Params, Query, RequestBody>(request.headers, params as Params, query as Query, requestBody as RequestBody)
            const response = await this.handle(decodedRequest)
            return new EncodedResponse(response)
        }
        return null;
    }
}
