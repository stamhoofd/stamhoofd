import { Database, ManyToOneRelation,OneToManyRelation } from '@simonbackx/simple-database';
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group, Webshop } from '@stamhoofd/models';
import { Member } from '@stamhoofd/models';
import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Registration } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedPaymentDetailed, EncryptedPaymentGeneral, getPermissionLevelNumber, Order as OrderStruct, PaymentPatch, PaymentStatus, PermissionLevel } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = PaymentPatch[]
type ResponseBody = EncryptedPaymentDetailed[]

type RegistrationWithMember = Registration & { member: Member}
type PaymentWithRegistrations = Payment & { registrations: RegistrationWithMember[] }
type PaymentWithOrder = Payment & { order: Order }

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchOrganizationPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(PaymentPatch as Decoder<PaymentPatch>)
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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


        const payments = await PatchOrganizationPaymentsEndpoint.getPaymentsWithRegistrations(user.organizationId)
        const orderPayments = await this.getPaymentsWithOrder(user.organizationId)

        let groups: Group[] = []
        let webshops: Webshop[] = []
        if (!user.permissions.hasFullAccess() && !user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
            groups = await Group.where({organizationId: user.organization.id})
        }

        if (!user.permissions.hasFullAccess() && !user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
            webshops = await Webshop.where({organizationId: user.organization.id})
        }

        // Modify payments
        for (const patch of request.body) {
            const pay = payments.find(p => p.id == patch.id)
            const orderPay = orderPayments.find(p => p.id == patch.id)
            const model = pay ?? orderPay

            if (!model) {
                throw new SimpleError({
                    code: "payment_not_found",
                    message: "Payment with id "+patch.id+" does not exist",
                    human: "De betaling die je wilt wijzigen bestaat niet of je hebt er geen toegang tot"
                })
            }

            if (!user.permissions.hasFullAccess() && !user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
                if (!pay) {
                    const webshop = webshops.find(w => w.id === orderPay?.order.webshopId)
                    if (!orderPay || !webshop || getPermissionLevelNumber(webshop.privateMeta.permissions.getPermissionLevel(user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write)) {
                        throw new SimpleError({
                            code: "payment_not_found",
                            message: "Payment with id "+patch.id+" does not exist",
                            human: "De betaling die je wilt wijzigen bestaat niet of je hebt er geen toegang tot"
                        })
                    }
                } else {
                    // Check permissions if not full permissions or paymetn permissions
                    const registrations = pay.registrations
                    if (!Member.haveRegistrationsWriteAccess(registrations, user, groups, true)) {
                        throw new SimpleError({
                            code: "payment_not_found",
                            message: "Payment with id "+patch.id+" does not exist",
                            human: "Je hebt geen toegang om deze betaling te wijzigen. Vraag het aan een hoofdbeheerder of beheerder met rechten voor het financieel beheer."
                        })
                    }
                }
            }

            if (patch.status) {
                if (model.status != PaymentStatus.Succeeded && model.paidAt === null && patch.status == PaymentStatus.Succeeded) {
                    model.paidAt = new Date()
                } else if (model.paidAt !== null && patch.status != PaymentStatus.Succeeded) {
                    model.paidAt = null
                }

                model.status = patch.status
            }

        }

        for (const payment of payments) {
            // Automatically checks if it is changed or not
            await payment.save()
        }

        for (const payment of orderPayments) {
            // Automatically checks if it is changed or not
            await payment.save()
        }

         return new Response(
            [...payments, ...orderPayments].map((p: any) => {
                return PatchOrganizationPaymentsEndpoint.getPaymentStructure(p)
            })
        );
    }

    static getPaymentStructure(p: PaymentWithRegistrations | PaymentWithOrder) {
        return EncryptedPaymentGeneral.create({
            id: p.id,
            method: p.method,
            status: p.status,
            price: p.price,
            freeContribution: p.freeContribution,
            transferDescription: p.transferDescription,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            registrations: (p as any).registrations?.map(r => Member.getRegistrationWithMemberStructure(r)) ?? [],
            order: (p as any).order ? OrderStruct.create(Object.assign({...(p as any).order}, { payment: null })) : null,
        })
    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    async getPaymentsWithOrder(organizationId: string): Promise<PaymentWithOrder[]> {
        let query = `SELECT ${Payment.getDefaultSelect()}, ${Order.getDefaultSelect()} from \`${Payment.table}\`\n`;
        query += `JOIN \`${Order.table}\` ON \`${Order.table}\`.\`${Order.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\`\n`
        query += `where \`${Order.table}\`.\`organizationId\` = ?`

        const [results] = await Database.select(query, [organizationId])
        const payments: PaymentWithOrder[] = []

        // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const paymentOrderRelation = new ManyToOneRelation(Order, "order")
        paymentOrderRelation.foreignKey = Order.payment.foreignKey

        for (const row of results) {
            const foundPayment = Payment.fromRow(row[Payment.table])
            if (!foundPayment) {
                throw new Error("Expected payment in every row")
            }

            const order = Order.fromRow(row[Order.table])
            if (!order) {
                throw new Error("Every payment should have a valid order")
            }

            const payment = foundPayment.setRelation(paymentOrderRelation, order)
            payments.push(payment)
        }

        return payments

    }

    /**
     * This needs to be here to prevent reference cycles (temporary)
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getPaymentsWithRegistrations(organizationId: string, memberId: string | null = null): Promise<PaymentWithRegistrations[]> {
        let query = `SELECT ${Payment.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${Member.getDefaultSelect()} from \`${Payment.table}\`\n`;
        if (memberId) {
            query += `JOIN \`${Registration.table}\` AS \`MemberCheckTable\` ON \`MemberCheckTable\`.\`${Registration.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\` AND \`MemberCheckTable\`.\`registeredAt\` is not null\n`
        }

        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Registration.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\` AND \`${Registration.table}\`.\`registeredAt\` is not null\n`
        

        query += `JOIN \`${Member.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`

        query += `where \`${Member.table}\`.\`organizationId\` = ?`

        const params = [organizationId]

        if (memberId) {
            query += ` AND \`MemberCheckTable\`.\`${Member.registrations.foreignKey}\` = ?`
            params.push(memberId)
        }

        const [results] = await Database.select(query, params)
        const payments: PaymentWithRegistrations[] = []

        // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const paymentRegistrationsRelation = new OneToManyRelation(Payment, Registration, "registrations", Registration.payment.foreignKey as keyof Registration)
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const foundPayment = Payment.fromRow(row[Payment.table])
            if (!foundPayment) {
                throw new Error("Expected payment in every row")
            }
            const _f = foundPayment.setManyRelation(paymentRegistrationsRelation, []) as PaymentWithRegistrations

            // Seach if we already got this member?
            const existingPayment = payments.find(m => m.id == _f.id)

            const payment: PaymentWithRegistrations = (existingPayment ?? _f)
            if (!existingPayment) {
                payments.push(payment)
            }

            // Check if we have a registration with a member
            const registration = Registration.fromRow(row[Registration.table])
            if (registration) {
                const member = Member.fromRow(row[Member.table])
                if (!member) {
                    throw new Error("Every registration should have a valid member")
                }

                const regWithMember: RegistrationWithMember = registration.setRelation(registrationMemberRelation, member)
                payment.registrations.push(regWithMember)
            }
        }

        return payments

    }
}
