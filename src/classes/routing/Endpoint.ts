import { Request } from "./Request";
import { ContentDecoder } from "./Decoder";
import { DecodedRequest } from './DecodedRequest';
import { Response } from "./Response";
import { EncodedResponse } from './EncodedResponse';
import { ContentEncoder } from './Encoder';

export class ResponseEncoder<Body> {
    bodyEncoder: ContentEncoder<Body, string>

    constructor(bodyEncoder: ContentEncoder<Body, string>) {
        this.bodyEncoder = bodyEncoder
    }

    encode(request: Request, response: Response<Body>): EncodedResponse {
        var encoded = new EncodedResponse();
        encoded.headers = response.headers

        const contentType = request.headers['Accept'];
        encoded.body = this.bodyEncoder.encodeContent(contentType, response.body)
        encoded.headers['Content-Type'] = contentType;

        return encoded;
    }
}

export class RequestDecoder<Params, Query, Body> {
    parametersDecoder: ContentDecoder<object, Params>
    queryDecoder: ContentDecoder<object, Query>
    bodyDecoder: ContentDecoder<string, Body>

    constructor(parametersDecoder: ContentDecoder<object, Params>, queryDecoder: ContentDecoder<object, Query>, bodyDecoder: ContentDecoder<string, Body>) {
        this.parametersDecoder = parametersDecoder
        this.queryDecoder = queryDecoder
        this.bodyDecoder = bodyDecoder
    }

    decode(request: Request): DecodedRequest<Params, Query, Body> {
        var decoded = new DecodedRequest<Params, Query, Body>();
        decoded.headers = request.headers
        const contentType = request.headers['Content-Type'];

        // Todo: augment thrown errors here by indicating if they origin in body, params or query
        decoded.body = this.bodyDecoder.decodeContent(contentType, request.body as string)
        decoded.params = this.parametersDecoder.decodeContent("", request.params)
        decoded.query = this.queryDecoder.decodeContent("", request.query)
        return decoded
    }
}


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
