import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, RegisterCode } from '@stamhoofd/models';
import {RegisterCode as RegisterCodeStruct } from "@stamhoofd/structures"
type Params = { code: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = RegisterCodeStruct;

export class CheckRegisterCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/register-code/@code", {code: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        
        const code = await RegisterCode.getByID(request.params.code)
        if (code) {
            return new Response(RegisterCodeStruct.create({
                code: code.code,
                description: code.description,
                customMessage: code.customMessage,
                organizationName: code.organizationId ? ((await Organization.getByID(code.organizationId))!.name) : null,
                value: code.value
            }))
        }

        throw new SimpleError({
            code: "invalid_code",
            message: "Invalid code",
            human: "Deze code is niet geldig",
            field: "registerCode"
        })
    }
}
