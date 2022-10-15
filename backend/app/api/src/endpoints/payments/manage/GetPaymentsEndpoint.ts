import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Payment, Token, UserWithOrganization } from "@stamhoofd/models";
import { PaymentGeneral, PermissionLevel } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined
type Body = undefined
type ResponseBody = PaymentGeneral[]

export class GetPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/payments", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        return new Response(
            (await this.getPayments(user, PermissionLevel.Read))
        );
    }

    async getPayments(user: UserWithOrganization, permissionLevel: PermissionLevel) {
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        // Only return payments that were paid the last 7 days
        const payments = await Payment.where({
            organizationId: user.organizationId, 
            paidAt: {
                sign: '>', 
                value: new Date(Date.now() - (24 * 60 * 60 * 1000 * 7 ))
            }
        });

        payments.push(...
            await Payment.where({
                organizationId: user.organizationId, 
                paidAt: null
            })
        );

        return await Payment.getGeneralStructure(payments, {user, permissionLevel})
    }
}
