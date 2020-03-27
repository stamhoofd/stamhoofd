import { Encodeable } from '../../structs/classes/Encodeable'
import { Response } from './Response'

interface Headers {
    [key: string]: string;
}

export class EncodedResponse {
    headers: Headers = {}
    body: any

    constructor(response: Response<Encodeable>) {
        this.headers = response.headers
        this.body = JSON.stringify(response.body.encode())
    }
}
