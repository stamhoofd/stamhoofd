import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Admin as AdminStruct, EditAdmin } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<EditAdmin>
type ResponseBody = AdminStruct;

export class PatchUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EditAdmin.patchType() as Decoder<AutoEncoderPatchType<EditAdmin>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const admin = await AdminToken.authenticate(request);

        admin.email = request.body.email ?? admin.email
        
        if (request.body.password) {
            await admin.changePassword(request.body.password)
        }
        await admin.save()
        
        const st = AdminStruct.create({
            id: admin.id,
            email: admin.email,
        })
        return new Response(st);      
    
    }
}
