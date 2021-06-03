import { OneToManyRelation } from '@simonbackx/simple-database';
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group } from '@stamhoofd/models';
import { Member } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Registration } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { CreatePaymentGeneral, EncryptedPaymentGeneral, PaymentMethod, PaymentStatus } from "@stamhoofd/structures";

import { PatchOrganizationPaymentsEndpoint } from './PatchOrganizationPaymentsEndpoint';
type Params = Record<string, never>;
type Query = undefined;
type Body = CreatePaymentGeneral[]
type ResponseBody = EncryptedPaymentGeneral[]

type RegistrationWithMember = Registration & { member: Member}
type PaymentWithRegistrations = Payment & { registrations: RegistrationWithMember[] }

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class CreateOrganizationPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(CreatePaymentGeneral as Decoder<CreatePaymentGeneral>)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
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

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access payments",
                human: "Je hebt geen toegang tot betalingen"
            })
        }

        const groups = await Group.where({organizationId: user.organization.id})

        const payments: PaymentWithRegistrations[] = []
        const paymentRegistrationsRelation = new OneToManyRelation(Payment, Registration, "registrations", Registration.payment.foreignKey as keyof Registration)

        // Create payments
        for (const create of request.body) {
            if (![PaymentMethod.Unknown, PaymentMethod.Transfer].includes(create.method)) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid payment method",
                    human: "De betaalmethode die je wilt gebruiken is niet toegestaan",
                    field: "method"
                })
            }
            if (create.registrationIds.length == 0) {
                throw new SimpleError({
                    code: "missing_registrations",
                    message: "Registration ids are required",
                    human: "Je moet een betaling aan ten minste één inschrijving koppelen"
                })
            }

            const registrations = (await Member.getRegistrationWithMembersByIDs(create.registrationIds)).filter(r => r.paymentId == null && !!groups.find(g => g.id === r.groupId))

            if (registrations.length == 0 || registrations.length !== create.registrationIds.length) {
                throw new SimpleError({
                    code: "invalid_registrations",
                    message: "Invalid registration ids",
                    human: "De inschrijving(en) waaraan je deze betaling wilt koppelen bestaan niet (meer)"
                })
            }

            if (!user.permissions.hasFullAccess() && !user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
                if (!Member.haveRegistrationsWriteAccess(registrations, user, groups, true)) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "Permissiong denied",
                        human: "Je hebt geen toegang om betalingen te wijzigen voor deze leden."
                    })
                }
            }

            const payment = new Payment().setManyRelation(paymentRegistrationsRelation, []) as PaymentWithRegistrations
            payment.organizationId = user.organizationId
            payment.method = create.method
            payment.status = create.status
            payment.price = create.price
            payment.freeContribution = create.freeContribution

            if (payment.method == PaymentMethod.Transfer && create.transferDescription === null) {
                // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
                payment.transferDescription = Payment.generateDescription(user.organization.meta.transferSettings, registrations.map(r => r.member.firstName).join(", "))
            } else {
                payment.transferDescription = create.transferDescription
            }
            
            payment.paidAt = create.paidAt

            if (payment.status !== PaymentStatus.Succeeded) {
                payment.paidAt = null
            } else {
                payment.paidAt = payment.paidAt ?? new Date()
            }
            await payment.save()

            // Save registrations and add extra data if needed
            for (const registration of registrations) {
                registration.paymentId = payment.id
                await registration.save()
            }
            payments.push(payment)
        }

        return new Response(
            payments.map((p: any) => {
                return PatchOrganizationPaymentsEndpoint.getPaymentStructure(p)
            })
        );
    }
}
