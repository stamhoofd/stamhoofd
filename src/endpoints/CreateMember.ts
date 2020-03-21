import { Endpoint } from '../classes/routing/Endpoint';
import { DecodedRequest } from '../classes/routing/DecodedRequest';
import { Request } from '../classes/routing/Request';
import { Response } from '../classes/routing/Response';
import { JSONContentEncoder } from '../classes/encoding/JSONContentEncoder';
import { EmptyDecoder } from '../classes/decoding/EmptyDecoder';
import { JSONContentDecoder } from '../classes/decoding/JSONContentDecoder';
import { Member, Record } from '../generated/structs';
import { ContentType } from '../classes/routing/ContentType';
import { RequestDecoder } from '../classes/decoding/RequestDecoder';
import { ResponseEncoder } from '../classes/encoding/ResponseEncoder';

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
    records: string[]

    static getContentTypes(): ContentType[] {
        // todo: detect supported content types
        return Member.all.flatMap(el => el.getContentTypes());
    }

    static encodeContent(contentType: ContentType, data: MemberModel): Member.All {
        var s: Member.All;

        if (Member.Version1.getContentTypes().some(type => type.matches(contentType))) {
            s = new Member.Version1();
            s.name = data.firstName + " " + data.lastName
        } else if (Member.Version2.getContentTypes().some(type => type.matches(contentType))) {
            s = new Member.Version2();
            s.firstName = data.firstName
            s.lastName = data.lastName
        } else {
            throw new Error("Could not encode MemberModel to " + contentType + ". Not supported");
        }

        s.records = data.records.map(r => {
            var record = new Record()
            record.name = r
            return record
        })
        return s;


    }
}

type Params = {}
type Query = {}
type RequestBody = Member.All
type ResponseBody = MemberModel

export class CreateMember extends Endpoint<Params, Query, RequestBody, ResponseBody> {
    requestDecoder: RequestDecoder<Params, Query, RequestBody> = new RequestDecoder(EmptyDecoder, EmptyDecoder, new JSONContentDecoder<RequestBody>(...Member.all))
    responseEncoder: ResponseEncoder<ResponseBody> = new ResponseEncoder(new JSONContentEncoder<ResponseBody>(MemberModel))

    protected doesMatch(request: Request): boolean {
        return true
    }

    protected handle(request: DecodedRequest<Params, Query, RequestBody>): Response<ResponseBody> {
        // Create the member model here
        var model = new MemberModel();

        model.id = 123
        model.phone = "onbekend"

        if (request.body instanceof Member.Version2) {
            model.firstName = request.body.firstName
            model.lastName = request.body.lastName
        }
        else if (request.body instanceof Member.Version1) {
            model.firstName = request.body.name
        } else {
            throw new Error("Unsupported input");
        }

        model.records = request.body.records.map(r => r.name)

        return new Response(model);
    }
}