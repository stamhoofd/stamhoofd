import { Request } from "./Request";
import { DecodedRequest } from './DecodedRequest';
import { Response } from "./Response";
import { EncodedResponse } from './EncodedResponse';
import { RequestDecoder } from '../decoding/RequestDecoder';
import { ResponseEncoder } from '../encoding/ResponseEncoder';

export abstract class Endpoint<Params, Query, RequestBody, ResponseBody> {
    requestDecoder: RequestDecoder<Params, Query, RequestBody>
    responseEncoder: ResponseEncoder<ResponseBody>

    protected abstract doesMatch(request: Request): boolean
    protected abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Response<ResponseBody>

    run(request: Request): EncodedResponse | null {
        if (this.doesMatch(request)) {
            return this.responseEncoder.encode(request, this.handle(this.requestDecoder.decode(request)));
        }
        return null;
    }
}
