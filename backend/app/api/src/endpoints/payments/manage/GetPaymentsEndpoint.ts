import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Group, Member, Order, Payment, Registration, Token, UserWithOrganization, Webshop } from "@stamhoofd/models";
import { BalanceItemDetailed, BalanceItemPaymentDetailed, getPermissionLevelNumber, Group as GroupStruct, Member as MemberStruct, Order as OrderStruct, PaymentGeneral, PermissionLevel, RegistrationWithMember } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

type Params = Record<string, never>;
type Query = undefined
type Body = undefined
type ResponseBody = PaymentGeneral

export class GetPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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
            (await GetPaymentEndpoint.getPayments(user, PermissionLevel.Read)).struct
        );
    }

    static async getPayments(user: UserWithOrganization, permissionLevel: PermissionLevel) {
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        // Only return non payments of last 7 days
        query += ` AND (\`${Payment.table}\`.\`paidAt\` is NULL OR \`${Payment.table}\`.\`paidAt\` > ?)`
        params.push(new Date(Date.now() - (24 * 60 * 60 * 1000 * 7 )))

        const payments = await Payment.where({
            organizationId: user.organizationId, 
            paidAt: {
                sign: '>', 
                value: new Date(Date.now() - (24 * 60 * 60 * 1000 * 7 ))
            }
        });


        const balanceItemPayments = await BalanceItemPayment.where({paymentId: payment.id})
        const ids = Formatter.uniqueArray(balanceItemPayments.flatMap(p => p.balanceItemId));
        const balanceItems = await BalanceItem.getByIDs(...ids);

        // Load members and orders
        const registrationIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.registrationId ? [b.registrationId] : []))
        const orderIds = Formatter.uniqueArray(balanceItems.flatMap(b => b.orderId ? [b.orderId] : []))

        const registrations = await Registration.getByIDs(...registrationIds)
        const orders = await Order.getByIDs(...orderIds)

        const memberIds = Formatter.uniqueArray(registrations.flatMap(b => b.memberId ? [b.memberId] : []))
        const members = await Member.getByIDs(...memberIds)

        const groupIds = Formatter.uniqueArray(registrations.flatMap(b => b.groupId ? [b.groupId] : []))
        const groups = await Group.getByIDs(...groupIds)

        let hasAccess = false;
        if (user.permissions.hasFullAccess() || user.permissions.canManagePayments(user.organization.privateMeta.roles)) {
            hasAccess = true;
        } else {
            for (const registration of registrations) {
                if (registration.hasAccess(user, groups, permissionLevel)) {
                    hasAccess = true;
                    break;
                }
            }

            if (!hasAccess) {
                for (const order of orders) {
                    const webshop = await Webshop.getByID(order.webshopId)
                    if (webshop && getPermissionLevelNumber(webshop.privateMeta.permissions.getPermissionLevel(user.permissions)) >= getPermissionLevelNumber(permissionLevel)) {
                        hasAccess = true;
                        break;
                    }
                }
            }
        }

        if (!hasAccess) {
            throw new SimpleError({
                code: "not_found",
                message: "Payment not found",
                human: "Je hebt geen togang tot deze betaling"
            })
        }

        return {
            payment,
            struct: PaymentGeneral.create({
                ...payment,
                balanceItemPayments: balanceItemPayments.map((item) => {
                    const balanceItem = balanceItems.find(b => b.id === item.balanceItemId)
                    const registration = balanceItem?.registrationId && registrations.find(r => r.id === balanceItem.registrationId)
                    const member = registration ? members.find(r => r.id === registration.memberId) : undefined
                    const group = registration ? groups.find(r => r.id === registration.groupId) : undefined
                    const order = balanceItem?.orderId && orders.find(r => r.id === balanceItem.orderId)

                    return BalanceItemPaymentDetailed.create({
                        ...item,
                        balanceItem: BalanceItemDetailed.create({
                            ...balanceItem,
                            registration: registration ? RegistrationWithMember.create({
                                ...registration,
                                member: MemberStruct.create(member!),
                                group: GroupStruct.create(group!)
                            }) : null,
                            order: order ? OrderStruct.create(order) : null
                        })
                    })
                })
            })
        }

    }
}
