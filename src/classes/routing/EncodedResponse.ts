interface Headers {
    [key: string]: string;
}
export class EncodedResponse {
    headers: Headers = {}
    body: any
}
