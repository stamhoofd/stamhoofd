import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedPaymentDetailed } from "@stamhoofd/structures";

import { Member } from '../models/Member';
import { Organization } from '../models/Organization';
import { Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { Token } from '../models/Token';
import { UserWithOrganization } from '../models/User';
type Params = {id: string};
type Query = undefined
type Body = undefined
type ResponseBody = EncryptedPaymentDetailed | undefined;

type RegistrationWithMember = Registration & { member: Member}
type PaymentWithRegistrations = Payment & { registrations: RegistrationWithMember[] }

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetPaymentRegistrations extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/payments/@id/registrations", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user
        
        const payment = await Payment.getByID(request.params.id)
        if (!payment) {
            throw new SimpleError({
                code: "",
                message: "Deze link is ongeldig"
            })
        }
        const registrations = await Member.getRegistrationWithMembersForPayment(payment.id)
        const authorizedMembers = (await Member.getMembersWithRegistrationForUser(user)).map(m => m.id)

        // Check permissions
        for (const registration of registrations) {
            if (!authorizedMembers.includes(registration.member.id)) {
                throw new SimpleError({
                    code: "",
                    message: "Deze link is ongeldig"
                })
            }
        }
               
        return new Response( 
            EncryptedPaymentDetailed.create({
                id: payment.id,
                method: payment.method,
                status: payment.status,
                price: payment.price,
                transferDescription: payment.transferDescription,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r))
            })
        );
    }
}
