import { Request } from "@/routing/classes/Request";
import { DecodedRequest } from "@/routing/classes/DecodedRequest";
import { Member } from "../models/Member";
import { Response } from "@/routing/classes/Response";
import { Endpoint } from "@/routing/classes/Endpoint";
import { MemberStruct } from "../structs/MemberStruct";

type Params = { id: number };
type Query = undefined;
type Body = undefined;
type ResponseBody = MemberStruct;

export class GetMember extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members/@id", { id: Number });

        if (params) {
            return [true, params as Params];
        }
        console.log("url doesnt match " + request.url);
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const id = request.params.id;
        const member = await Member.getByID(id);

        if (!member) {
            throw new Error("Member not found with id " + id);
        }

        const st = new MemberStruct({ member: member });
        return new Response(st);
    }
}
