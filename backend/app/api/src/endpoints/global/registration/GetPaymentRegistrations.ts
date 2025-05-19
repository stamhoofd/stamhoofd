import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, Payment, Registration } from '@stamhoofd/models';
import { PaymentWithRegistrations } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../helpers/Context';
type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = PaymentWithRegistrations | undefined;

export class GetPaymentRegistrations extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments/@id/registrations', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        const payment = await Payment.getByID(request.params.id);
        if (!payment) {
            throw new SimpleError({
                code: '',
                message: $t(`35b369bd-5766-41d1-8da3-3d362e316c1a`),
            });
        }
        const registrations = await Member.getRegistrationWithMembersForPayment(payment.id);
        const authorizedMembers = (await Member.getMembersWithRegistrationForUser(user)).map(m => m.id);
        const groups = await Group.getByIDs(...Formatter.uniqueArray(registrations.map(r => r.groupId)));

        // Check permissions
        for (const registration of registrations) {
            if (!authorizedMembers.includes(registration.member.id)) {
                throw new SimpleError({
                    code: '',
                    message: $t(`35b369bd-5766-41d1-8da3-3d362e316c1a`),
                });
            }
        }

        return new Response(
            PaymentWithRegistrations.create({
                id: payment.id,
                method: payment.method,
                status: payment.status,
                price: payment.price,
                freeContribution: payment.freeContribution,
                transferDescription: payment.transferDescription,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                registrations: registrations.map(r => Member.getRegistrationWithTinyMemberStructure(r.setRelation(Registration.group, groups.find(g => g.id === r.groupId)!))),
            }),
        );
    }
}
