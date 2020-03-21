import { ContentEncoder } from './ContentEncoder';
import { Request } from '../routing/Request';
import { EncodedResponse } from '../routing/EncodedResponse';
import { Response } from '../routing/Response';
import { ContentType } from '../routing/ContentType';

export class ResponseEncoder<Body> {
    bodyEncoder: ContentEncoder<Body, string>

    constructor(bodyEncoder: ContentEncoder<Body, string>) {
        this.bodyEncoder = bodyEncoder
    }

    encode(request: Request, response: Response<Body>): EncodedResponse {
        var encoded = new EncodedResponse();
        encoded.headers = response.headers

        const contentType = ContentType.fromString(request.headers['Accept']);
        encoded.body = this.bodyEncoder.encodeContent(contentType, response.body)
        encoded.headers['Content-Type'] = contentType.toString();

        return encoded;
    }
}


