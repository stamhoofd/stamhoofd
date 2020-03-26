import { Endpoint } from '../classes/routing/Endpoint';
import { DecodedRequest } from '../classes/routing/DecodedRequest';
import { Request } from '../classes/routing/Request';
import { Response } from '../classes/routing/Response';
import { JSONContentEncoder } from '../classes/encoding/JSONContentEncoder';
import { EmptyDecoder } from '../classes/decoding/EmptyDecoder';
import { JSONContentDecoder } from '../classes/decoding/JSONContentDecoder';
import { Member, Record } from '../generated/structs';
import { Member as MemberModel } from '../members/models/Member';
import { ContentType } from '../classes/routing/ContentType';
import { RequestDecoder } from '../classes/decoding/RequestDecoder';
import { ResponseEncoder } from '../classes/encoding/ResponseEncoder';
import { ContentEncoderGroup } from '../classes/encoding/ContentEncoderGroup';
import { EncodedResponse } from '../classes/routing/EncodedResponse';


class ArrayOf<T extends { type: string }> {
    content: T[]
    get type(): T["type"] {
        return this.content.type
    }

    constructor(content: T[]) {
        this.content = content
    }
}
function isArrayOf<T extends { type: string }>(val: any): val is ArrayOf<T> {
    return val.content
}
const test = new ArrayOf<Member.Version1>([])
test.type

type Params = {}
type Query = {}
type RequestBody = Member.All
type ResponseBody = Member.All | Member.All[]

export class CreateMember extends Endpoint<Params, Query, RequestBody, ResponseBody> {
    requestDecoder: RequestDecoder<Params, Query, RequestBody> = new RequestDecoder(EmptyDecoder, EmptyDecoder, new JSONContentDecoder<RequestBody>(...Member.all))
    responseEncoder: ResponseEncoder<ResponseBody> = new ResponseEncoder(new JSONContentEncoder<ResponseBody>(new ContentEncoderGroup<ResponseBody>(...Member.all)))

    protected doesMatch(request: Request): boolean {
        return true
    }

    protected async handlet(request: DecodedRequest<Params, Query, RequestBody>, response: Response<ResponseBody>): Promise<void> {
        // Create the member model here


        switch (response.body.type) {
            case Member.Version1.type:
            case Member.Version2.type:
                const model = await MemberModel.getByID(123)

                if (!model) {
                    throw new Error("Not found")
                }
                if (isArrayOf(response.body)) {
                    response.body.content[0].from(model)
                } else {
                    response.body.from(model)
                }
                return
            case "other":
                // Do other logic here
                break
            default:
                // If you get a compile error here: a type is missing in the switch to make it exhaustive
                const type: never = response.body;
                throw new Error("This will never run: " + type)
        }


        if (Member.is(response.body)) {
            const model = await MemberModel.getByID(123)

            if (!model) {
                throw new Error("Not found")
            }
            responseBody.from(model)
            return new Response(responseBody)
        }

        return new Response(responseBody)
    }
}