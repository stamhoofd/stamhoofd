import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Payment, Token, UserWithOrganization } from "@stamhoofd/models";
import { PaymentGeneral, PermissionLevel } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = PaymentGeneral

export class GetPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/payments/@id", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        return new Response(
            (await this.getPayment(request.params.id, user, PermissionLevel.Read))
        );
    }

    async getPayment(id: string, user: UserWithOrganization, permissionLevel: PermissionLevel) {
        const payment = await Payment.getByID(id);
        if (!payment || payment.organizationId !== user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Payment not found",
                human: "Deze betaling werd niet gevonden."
            })
        }

        return await payment.getGeneralStructure({user, permissionLevel})
    }
}
