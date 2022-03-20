import { Database, ManyToOneRelation,OneToManyRelation } from '@simonbackx/simple-database';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Member } from '@stamhoofd/models';
import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Registration } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedPaymentGeneral, Order as OrderStruct, OrderStatus, PaymentMethod } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = EncryptedPaymentGeneral[]

type RegistrationWithMember = Registration & { member: Member}
type PaymentWithRegistrations = Payment & { registrations: RegistrationWithMember[] }
type PaymentWithOrder = Payment & { order: Order }

export class GetOrganizationPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions || !user.permissions.canManagePayments(token.user.organization.privateMeta.roles)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access payments",
                human: "Je hebt geen toegang tot betalingen",
                statusCode: 403
            })
        }

        // Get all payments that are connected with one or more registrations.
        // Also link the members of those registrations, so we know the names.
        const payments = await GetOrganizationPaymentsEndpoint.getPaymentsWithRegistrations(user.organizationId)
        const orderPayments = await GetOrganizationPaymentsEndpoint.getPaymentsWithOrder(user.organizationId)

        return new Response(
            [...payments, ...orderPayments].map((p) => {
                return GetOrganizationPaymentsEndpoint.getPaymentStructure(p)
            })
        );
    }

    static getPaymentStructure(p: PaymentWithRegistrations | PaymentWithOrder): EncryptedPaymentGeneral {
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            registrations: (p as any).registrations?.map(r => Member.getRegistrationWithMemberStructure(r, true)) ?? [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            order: (p as any).order ? OrderStruct.create(Object.assign({...(p as any).order}, { payment: null })) : null
        })
    }
    
    static async getPaymentsWithOrder(organizationId: string, withCanceledOrDeleted = false, onlyTransfer = true): Promise<PaymentWithOrder[]> {
        let query = `SELECT ${Payment.getDefaultSelect()}, ${Order.getDefaultSelect()} from \`${Payment.table}\`\n`;
        query += `JOIN \`${Order.table}\` ON \`${Order.table}\`.\`${Order.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\`\n`
        query += `where \`${Order.table}\`.\`organizationId\` = ?`

        const params: any = [organizationId]

        if (!withCanceledOrDeleted) {
            query += ` AND \`${Order.table}\`.\`status\` NOT IN (?)`
            params.push([OrderStatus.Canceled, OrderStatus.Deleted])
        }

        if (onlyTransfer) {
            // Only return non paid paymetns and payments of last 2 months
            query += ` AND (\`${Payment.table}\`.\`method\` = ?)`
            params.push(PaymentMethod.Transfer)
        }

        const [results] = await Database.select(query, params)
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
    static async getPaymentsWithRegistrations(organizationId: string, memberId: string | null = null, onlyTransfer = true): Promise<PaymentWithRegistrations[]> {
        let query = `SELECT ${Payment.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${Member.getDefaultSelect()} from \`${Payment.table}\`\n`;
        if (memberId) {
            query += `JOIN \`${Registration.table}\` AS \`MemberCheckTable\` ON \`MemberCheckTable\`.\`${Registration.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\` AND \`MemberCheckTable\`.\`registeredAt\` is not null\n`
        }

        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Registration.payment.foreignKey}\` = \`${Payment.table}\`.\`${Payment.primary.name}\` AND \`${Registration.table}\`.\`registeredAt\` is not null\n`
        

        query += `JOIN \`${Member.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`

        query += `where \`${Member.table}\`.\`organizationId\` = ?`

        const params: any[] = [organizationId]

        if (memberId) {
            query += ` AND \`MemberCheckTable\`.\`${Member.registrations.foreignKey}\` = ?`
            params.push(memberId)
        } else {
            // Only return non paid paymetns and payments of last 2 months
            query += ` AND (\`${Payment.table}\`.\`paidAt\` is NULL OR \`${Payment.table}\`.\`paidAt\` > ?)`
            params.push(new Date(Date.now() - (24 * 60 * 60 * 1000 * 30 * 2)))
        }

        if (onlyTransfer) {
            // Only return non paid paymetns and payments of last 2 months
            query += ` AND (\`${Payment.table}\`.\`method\` = ?)`
            params.push(PaymentMethod.Transfer)
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
