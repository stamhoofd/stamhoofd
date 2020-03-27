import { Request } from '../../routing/classes/Request';
import { EncodedResponse } from '../../routing/classes/EncodedResponse';
import { DecodedRequest } from '../../routing/classes/DecodedRequest';
import { Data } from '../../structs/classes/Data';
import { StringDecoder } from '../../classes/decoding/StringDecoder';
import { Member } from '../models/Member';
import { Response } from '../../routing/classes/Response';
import { Encodeable } from '../../structs/classes/Encodeable';
import { NumberDecoder } from '../../classes/decoding/NumberDecoder';
import { Endpoint } from '../../routing/classes/Endpoint';

export class MemberStruct implements Encodeable {
    name: string

    constructor()
    constructor(data?: Data) {
        if (data !== undefined) {
            this.name = data.field("name").decode(StringDecoder);
        }
    }

    encode(): any {
        return this;
    }
}

/*
class Params {
    id: number

    constructor(id: number) {
        this.id = id
    }

    static decode(data: Data): Params {
        return new this(data.field("id").decode(NumberDecoder));
    }
}*/

function paramParser<T extends string>(url: string, template: string, params: T[]): Record<T, string> | undefined {
    const parts = url.split('/')
    const templateParts = template.split('/')

    if (template.length != templateParts.length) {
        // No match
        return
    }

    let paramIndex = 0 // index in params
    let paramPosition = params.length > paramIndex ? templateParts.indexOf("@" + params[paramIndex]) : -1 // index in parts
    let resultParams: Record<T, string> = {} as any

    for (let index = 0; index < parts.length; index++) {
        const part = parts[index]

        if (index == paramPosition) {
            resultParams[params[paramIndex]] = part

            paramIndex++
            paramPosition = params.length > paramIndex ? templateParts.indexOf("@" + params[paramIndex], paramPosition) : -1
        } else {
            const templatePart = templateParts[index]
            if (templatePart != part) {
                // no match
                return
            }
        }

        return resultParams
    }


    // Search params
    let lastIndex = 0
    for (let index = 0; index < params.length; index++) {
        const param = params[index];
        lastIndex = templateParts.indexOf("@" + param, lastIndex)
        if (lastIndex == -1) {
            throw new Error("Parameter " + param + " expected. Also check if params are specified in the order of usage")
        }

    }
}

type Params = { id: string }
type Query = undefined
type Body = undefined

type MyRequest = DecodedRequest<Params, Query, Body>;
type ResponseBody = MemberStruct

export class GetMember extends Endpoint<Params, Query, Body, ResponseBody> {
    protected query = undefined
    protected body = undefined

    protected doesMatch(request: Request): [true, Params] | [false] {
        const params = paramParser("/member/123", "/member/@id", ["id"])

        if (params) {
            return [true, params as Params]
        }
        return [false]
    }

    async handle(request: MyRequest) {
        const id = request.params.id
        const member = await Member.getByID(id)

        if (!member) {
            throw new Error("Member not found with id " + id)
        }

        const st = new MemberStruct()
        st.name = member.firstName + " " + member.lastName
        return new Response(st)
    }
}