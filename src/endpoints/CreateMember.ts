import { Endpoint, ResponseEncoder, RequestDecoder } from '../classes/routing/Endpoint';
import { DecodedRequest } from '../classes/routing/DecodedRequest';
import { Request } from '../classes/routing/Request';
import { Response } from '../classes/routing/Response';
import { ContentEncoder, JSONContentEncoder } from '../classes/routing/Encoder';
import { ContentDecoder, Data, ObjectData, JSONContentDecoder, EmptyDecoder } from '../classes/routing/Decoder';
import { EncodedResponse } from '@src/classes/routing/EncodedResponse';


// Shared between front and back-end
// input types
// output types
// Moeten onderling elkaar kunnen extenden
// => generated code die optimaal is, zonder reflection + die extendable is lokaal met custom properties en functies
// => generated documentatie
// => generated request code voor frontend
// => versioning?
//      => frontend = altijd laatste versie, maar oude frontend blijven werken
//      => backend = ondersteund verschillende versies en deprecate indien nodig
// backend code is type checked at compile time
// API kan geleidelijk aan upgraden, ipv meteen alle endpoints aan zelfde versie te koppelen
// Opgelet: er moet wel een systeem zijn om te detecteren dat frontend nog oude versies gebruiken
// Voordeel: je kan verschillende output types gebruiken voor minder / meer data terug te geven



class MemberModel /* static implements ContentEncoder<MemberModel> */ {
    id: number
    firstName: string
    lastName: string
    phone: string

    static getContentTypes(): string[] {
        // todo: detect supported content types
        return [MemberStructV1, MemberStructV2, CreatedMemberStructV2].flatMap(el => el.getContentTypes());
    }

    static encodeContent(contentType: string, data: MemberModel): MemberStructV1 | MemberStructV2 | CreatedMemberStructV2 {
        if (MemberStructV1.getContentTypes().includes(contentType)) {
            return new MemberStructV1();
        }
        if (MemberStructV2.getContentTypes().includes(contentType)) {
            return new MemberStructV2();
        }
        if (CreatedMemberStructV2.getContentTypes().includes(contentType)) {
            // Hacky way to do decoding
            return CreatedMemberStructV2.decodeContent(contentType, new ObjectData(data));
        }
        throw new Error("Could not encode MemberModel to " + contentType + ". Not supported");
    }

}

class MemberStructV1 /* static implements ContentEncoder<MemberStructV1, any>, MemberStructV1 */ {
    name: string
    phone: string

    static getContentTypes(): string[] {
        return ["application/MemberStructV1"];
    }

    static decodeContent(contentType: string, data: Data): MemberStructV1 {
        var t = new MemberStructV1()
        t.name = data.field("name").string
        return t;
    }

    static encodeContent(contentType: string, data: MemberStructV1): any {
        return {
            "name": data.name
        }
    }
}


class MemberStructV2 {
    firstName: string = ""
    lastName: string = ""
    phone: string | null

    static getContentTypes(): string[] {
        return ["application/MemberStructV2"];
    }

    static decodeContent(contentType: string, data: Data): MemberStructV2 {
        var t = new MemberStructV2()
        t.firstName = data.field("firstName").string
        t.lastName = data.field("lastName").string
        t.phone = data.field("phone").string
        return t;
    }

    static encodeContent(contentType: string, data: MemberStructV2): any {
        return {
            "firstName": data.firstName,
            "lastName": data.lastName,
            "phone": data.phone
        }
    }
}

class CreatedMemberStructV2 extends MemberStructV2 {
    id: number;

    static getContentTypes(): string[] {
        return ["application/CreatedMemberStructV2"];
    }

    static decodeContent(contentType: string, data: Data): CreatedMemberStructV2 {
        var t = Object.assign(new CreatedMemberStructV2(), super.decodeContent(contentType, data))
        t.id = data.field("id").number
        return t;
    }

    static encodeContent(contentType: string, data: CreatedMemberStructV2): any {
        return Object.assign({
            id: data.id
        }, super.encodeContent(contentType, data))
    }
}

type Params = {}
type Query = {}
type RequestBody = MemberStructV1 | MemberStructV2
type ResponseBody = MemberModel

export class CreateMember extends Endpoint<Params, Query, RequestBody, ResponseBody> {
    requestDecoder: RequestDecoder<Params, Query, RequestBody> = new RequestDecoder(EmptyDecoder, EmptyDecoder, new JSONContentDecoder<RequestBody>(MemberStructV1, MemberStructV2))
    responseEncoder: ResponseEncoder<ResponseBody> = new ResponseEncoder(new JSONContentEncoder<ResponseBody>(MemberModel))

    protected doesMatch(request: Request): boolean {
        return true
    }

    protected handle(request: DecodedRequest<Params, Query, RequestBody>): Response<ResponseBody> {
        // Create the member model here
        var model = new MemberModel();

        model.id = 123
        model.phone = request.body.phone || "onbekend"

        if (request.body instanceof MemberStructV2) {
            model.firstName = request.body.firstName
            model.lastName = request.body.lastName
        }
        else if (request.body instanceof MemberStructV1) {
            model.firstName = request.body.name
        } else {
            throw new Error("Unsupported input");
        }

        return new Response(model);
    }
}