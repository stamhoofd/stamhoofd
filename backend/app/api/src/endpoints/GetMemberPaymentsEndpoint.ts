import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedPaymentDetailed } from "@stamhoofd/structures";
import { Group } from "../models/Group";

import { Member } from '../models/Member';
import { Token } from '../models/Token';
import { PatchOrganizationPaymentsEndpoint } from "./PatchOrganizationPaymentsEndpoint";
type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = EncryptedPaymentDetailed[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetMemberPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members/@id/payments", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const member = (await Member.getWithRegistrations(request.params.id))
        const groups = await Group.where({ organizationId: user.organizationId })

        if (! member || member.organizationId != user.organizationId || !member.hasReadAccess(user, groups)) {
            throw new SimpleError({
                code: "not_found",
                message: "No members found",
                human: "Geen leden gevonden, of je hebt geen toegang to deze leden"
            })
        }

        const payments = await PatchOrganizationPaymentsEndpoint.getPaymentsWithRegistrations(user.organizationId, member.id)

        return new Response(
            payments.map((p: any) => {
                return PatchOrganizationPaymentsEndpoint.getPaymentStructure(p)
            })
        );
    }
}
