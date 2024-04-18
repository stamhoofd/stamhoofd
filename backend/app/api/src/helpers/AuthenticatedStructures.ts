import { SimpleError } from "@simonbackx/simple-errors";
import { Group, Organization, Payment, Webshop } from "@stamhoofd/models";
import { Group as GroupStruct, Organization as OrganizationStruct, PaymentGeneral, PermissionLevel, PrivateWebshop, Webshop as WebshopStruct,WebshopPreview } from '@stamhoofd/structures';

import { Context } from "./Context";

/**
 * Builds authenticated structures for the current user
 */
export class AuthenticatedStructures {
    static async paymentGeneral(payment: Payment, checkPermissions = true): Promise<PaymentGeneral> {
        return (await this.paymentsGeneral([payment], checkPermissions))[0]
    }

    /**
     * 
     * @param payments 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    static async paymentsGeneral(payments: Payment[], checkPermissions = true): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return []
        }

        const {balanceItemPayments, balanceItems} = await Payment.loadBalanceItems(payments)
        const {registrations, orders, members} = await Payment.loadBalanceItemRelations(balanceItems);

        if (checkPermissions) {
            // Note: permission checking is moved here for performacne to avoid loading the data multiple times
            if (!(await Context.auth.canAccessBalanceItems(balanceItems, PermissionLevel.Read, {registrations, orders, members}))) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Payment not found",
                    human: "Je hebt geen toegang tot deze betaling"
                })
            }
        }

        const includeSettlements = checkPermissions && !!Context.user && !!Context.user.permissions

        return Payment.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
            registrations,
            orders,
            members
        }, includeSettlements)
    }

    static group(group: Group) {
        const struct = GroupStruct.create(group)
        if (!Context.optionalAuth?.canAccessGroup(group)) {
            struct.privateSettings = null
        }
        return struct
    }

    static webshop(webshop: Webshop) {
        if (Context.optionalAuth?.canAccessWebshop(webshop)) {
            return PrivateWebshop.create(webshop)
        }
        return WebshopStruct.create(webshop)
    }

    static async organization(organization: Organization): Promise<OrganizationStruct> {
        if (Context.optionalAuth?.canAccessPrivateOrganizationData(organization)) {
            const groups = await Group.getAll(organization.id)
            const webshops = await Webshop.where({ organizationId: organization.id }, { select: Webshop.selectColumnsWithout(undefined, "products", "categories")})
            
            return OrganizationStruct.create({
                id: organization.id,
                name: organization.name,
                meta: organization.meta,
                address: organization.address,
                registerDomain: organization.registerDomain,
                uri: organization.uri,
                website: organization.website,
                groups: groups.map(g => this.group(g)).sort(GroupStruct.defaultSort),
                privateMeta: organization.privateMeta,
                webshops: webshops.flatMap(w => {
                    if (!Context.auth.canAccessWebshop(w)) {
                        return []
                    }
                    return [WebshopPreview.create(w)]
                })
            })
        }
        
        return await organization.getStructure()
    }
}