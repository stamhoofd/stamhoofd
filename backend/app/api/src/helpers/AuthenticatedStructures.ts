import { SimpleError } from "@simonbackx/simple-errors";
import { Group, MemberWithRegistrations, Organization, Payment, User, Webshop } from "@stamhoofd/models";
import { User as UserStruct, Group as GroupStruct, MembersBlob, Organization as OrganizationStruct, PaymentGeneral, PermissionLevel, PrivateWebshop, Webshop as WebshopStruct,WebshopPreview, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

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

    static async group(group: Group) {
        if (!await Context.optionalAuth?.canAccessGroup(group)) {
            return group.getStructure()
        }
        return group.getPrivateStructure()
    }

    static async webshop(webshop: Webshop) {
        if (await Context.optionalAuth?.canAccessWebshop(webshop)) {
            return PrivateWebshop.create(webshop)
        }
        return WebshopStruct.create(webshop)
    }

    static async organization(organization: Organization): Promise<OrganizationStruct> {
        if (await Context.optionalAuth?.canAccessPrivateOrganizationData(organization)) {
            const groups = await Group.getAll(organization.id)
            const webshops = await Webshop.where({ organizationId: organization.id }, { select: Webshop.selectColumnsWithout(undefined, "products", "categories")})
            const webshopStructures: WebshopPreview[] = [] 
            const groupStructures: GroupStruct[] = []

            for (const w of webshops) {
                if (!await Context.auth.canAccessWebshop(w)) {
                    continue
                }
                webshopStructures.push(WebshopPreview.create(w))
            }

            for (const g of groups) {
                groupStructures.push(await this.group(g))
            }

            return OrganizationStruct.create({
                id: organization.id,
                name: organization.name,
                meta: organization.meta,
                address: organization.address,
                registerDomain: organization.registerDomain,
                uri: organization.uri,
                website: organization.website,
                groups: groupStructures.sort(GroupStruct.defaultSort),
                privateMeta: organization.privateMeta,
                webshops: webshopStructures
            })
        }
        
        return await organization.getStructure()
    }

    static async adminOrganizations(organizations: Organization[]): Promise<OrganizationStruct[]> {
        const structs: OrganizationStruct[] = [];
        const admins = await User.getAdmins(organizations.map(o => o.id))

        for (const organization of organizations) {
            const base = await organization.getStructure({emptyGroups: true})
            base.admins = admins.filter(a => a.permissions?.organizationPermissions.has(organization.id)).map(a => UserStruct.create({...a, hasAccount: a.hasAccount()}))
            structs.push(base)
        }
        
        return structs
    }

    static async membersBlob(members: MemberWithRegistrations[], includeContextOrganization = false): Promise<MembersBlob> {
        const organizations = new Map<string, Organization>()
        const memberBlobs: MemberWithRegistrationsBlob[] = []
        for (const member of members) {
            for (const registration of member.registrations) {
                if (includeContextOrganization || registration.organizationId !== Context.auth.organization?.id) {
                    const found = organizations.get(registration.id);
                    if (!found) {
                        const organization = await Context.auth.getOrganization(registration.organizationId)
                        organizations.set(organization.id, organization)
                    }
                }
            }

            const blob = member.getStructureWithRegistrations()
            memberBlobs.push(
                await Context.auth.filterMemberData(member, blob)
            )
        }

        return MembersBlob.create({
            members: memberBlobs,
            organizations: await Promise.all([...organizations.values()].map(o => this.organization(o)))
        })
    }
}
