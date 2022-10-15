import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Group, Member, Order, Payment, Registration, Token, UserWithOrganization, Webshop } from "@stamhoofd/models";
import { BalanceItemDetailed, BalanceItemPaymentDetailed, getPermissionLevelNumber, Group as GroupStruct, Member as MemberStruct, Order as OrderStruct, PaymentGeneral, PermissionLevel, RegistrationWithMember } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = PaymentGeneral

export class GetPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/payments/@id", { id: String});

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
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

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
