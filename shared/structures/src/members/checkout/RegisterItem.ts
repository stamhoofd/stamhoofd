import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors"
import { v4 as uuidv4 } from "uuid"
import { Group, GroupType } from "../../Group"
import { GroupOption, GroupOptionMenu, GroupPrice, WaitingListType } from "../../GroupSettings"
import { Organization } from "../../Organization"
import { PlatformMember } from "../PlatformMember"
import { Registration } from "../Registration"
import { RegisterContext } from "./RegisterCheckout"
import { StockReservation } from "../../StockReservation"
import { RegistrationWithMember } from "../RegistrationWithMember"
import { PriceBreakdown } from "../../PriceBreakdown"

export class RegisterItemOption extends AutoEncoder {
    @field({ decoder: GroupOption })
    option: GroupOption;

    @field({ decoder: GroupOptionMenu })
    optionMenu: GroupOptionMenu;

    @field({ decoder: IntegerDecoder })
    amount = 1
}

export class IDRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    memberId: string

    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: StringDecoder })
    organizationId: string

    @field({ decoder: GroupPrice })
    groupPrice: GroupPrice;

    @field({ decoder: new ArrayDecoder(RegisterItemOption) })
    options: RegisterItemOption[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    replaceRegistrationIds: string[] = []

    hydrate(context: RegisterContext) {
        return RegisterItem.fromId(this, context)
    }
}

export class RegisterItem {
    id: string;
    
    member: PlatformMember
    group: Group
    organization: Organization

    groupPrice: GroupPrice;
    options: RegisterItemOption[] = []

    /**
     * Price for the new registration
     */
    calculatedPrice = 0

    /**
     * Refund for the replaced registrations
     */
    calculatedRefund = 0

    /**
     * These registrations will be replaced as part of this new registration (moving or updating a registration is possible this way)
     */
    replaceRegistrations: Registration[] = []

    /**
     * Show an error in the cart for recovery
     */
    cartError: SimpleError|SimpleErrors | null = null;

    /**
     * @deprecated
     */
    get waitingList() {
        return false;
    }

    static fromRegistration(registration: Registration, member: PlatformMember, organization: Organization) {
        return new RegisterItem({
            id: registration.id,
            member,
            group: registration.group,
            organization,
            groupPrice: registration.groupPrice,
            options: registration.options
        })
    }

    static defaultFor(member: PlatformMember, group: Group, organization: Organization) {
        if (group.organizationId !== organization.id) {
            throw new Error("Group and organization do not match in RegisterItem.defaultFor")
        }

        const item = new RegisterItem({
            member,
            group,
            organization
        });

        //if (item.shouldUseWaitingList() && group.waitingList) {
        //    group = group.waitingList
        //    item = RegisterItem.defaultFor(member, group, organization);
        //}

        return item;
    }

    constructor(data: {
        id?: string, 
        member: PlatformMember, 
        group: Group, 
        organization: Organization,
        groupPrice?: GroupPrice,
        options?: RegisterItemOption[],
        replaceRegistrations?: Registration[]
    }) {
        this.id = data.id ?? uuidv4()
        this.member = data.member
        this.group = data.group

        this.groupPrice = data.groupPrice ?? this.group.settings.prices[0] ?? GroupPrice.create({name: 'Ongeldig tarief', id: ''})
        this.organization = data.organization
        this.options = data.options ?? []
        this.replaceRegistrations = data.replaceRegistrations ?? []

        // Select all defaults
        for (const optionMenu of this.group.settings.optionMenus) {
            if (!optionMenu.multipleChoice) {
                if (this.options.find(o => o.optionMenu.id === optionMenu.id)) {
                    continue
                }

                this.options.push(
                    RegisterItemOption.create({
                        option: optionMenu.options[0],
                        optionMenu: optionMenu,
                        amount: 1
                    })
                )
            }
        }
    }

    get isInCart() {
        return this.member.family.checkout.cart.contains(this)
    }

    get showItemView() {
        return this.shouldUseWaitingList() || !!this.replaceRegistrations.length || this.group.settings.prices.length > 1 || this.group.settings.optionMenus.length > 0 || (!this.isInCart && !this.isValid)
    }

    calculatePrice() {
        this.calculatedPrice = this.groupPrice.price.forMember(this.member)
        this.calculatedRefund = 0

        for (const option of this.options) {
            this.calculatedPrice += option.option.price.forMember(this.member) * option.amount
        }

        for (const registration of this.replaceRegistrations) {
            this.calculatedRefund += registration.price
        }
    }

    get totalPrice() {
        return this.calculatedPrice - this.calculatedRefund
    }

    get priceBreakown(): PriceBreakdown {
        let all: PriceBreakdown = []

        let replacePrice = 0;
        for (const registration of this.replaceRegistrations) {
            replacePrice += registration.price

            all.push({
                name: this.checkout.isAdminFromSameOrganization ? 'Reeds aangerekend voor ' + registration.group.settings.name : 'Terugbetaling '+registration.group.settings.name,
                price: -registration.price
            })
        }

        all = all.filter(a => a.price !== 0)

        if (all.length > 0) {
            all.unshift({
                name: 'Subtotaal',
                price: this.calculatedPrice
            })
        }
        return [
            ...all,
            {
                name: this.checkout.isAdminFromSameOrganization ? (this.totalPrice  >= 0 ? 'Openstaand bedrag stijgt met' : 'Openstaand bedrag daalt met') : 'Totaal',
                price: this.checkout.isAdminFromSameOrganization ? Math.abs(this.totalPrice) : this.totalPrice
            }
        ];
    }

    clone() {
        return new RegisterItem({
            id: this.id,
            member: this.member,
            group: this.group,
            organization: this.organization,
            groupPrice: this.groupPrice.clone(),
            options: this.options.map(o => o.clone()),
            replaceRegistrations: this.replaceRegistrations.map(r => r.clone())
        })
    }

    copyFrom(item: RegisterItem) {
        this.groupPrice = item.groupPrice.clone()
        this.options = item.options.map(o => o.clone())
        this.calculatedPrice = item.calculatedPrice
    }

    getFilteredPrices() {
        const base = this.group.settings.getFilteredPrices({admin: this.checkout.isAdminFromSameOrganization})

        if (!base.some(b => b.id === this.groupPrice.id)) {
            return [this.groupPrice, ...base]
        }
        return base;
    }

    getFilteredOptionMenus() {
        return this.group.settings.getFilteredOptionMenus({admin: this.checkout.isAdminFromSameOrganization})
    }

    getFilteredOptions(menu: GroupOptionMenu) {
        return menu.getFilteredOptions({admin: this.checkout.isAdminFromSameOrganization})
    }

    convert(): IDRegisterItem {
        return IDRegisterItem.create({
            id: this.id,
            memberId: this.member.member.id,
            groupId: this.group.id,
            organizationId: this.organization.id,
            groupPrice: this.groupPrice,
            options: this.options,
            replaceRegistrationIds: this.replaceRegistrations.map(r => r.id)
        })
    }

    get memberId() {
        return this.member.id
    }

    get groupId() {
        return this.group.id
    }

    get reduced() {
        return this.member.patchedMember.details.requiresFinancialSupport?.value ?? false
    }

    get family() {
        return this.member.family
    }

    get checkout() {
        return this.family.checkout
    }

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(group: Group) {
        this.group = group
        
        const errors = new SimpleErrors()

        if (this.group.settings.prices.length === 0) {
            errors.addError(
                new SimpleError({
                    code: "product_unavailable",
                    message: "Product unavailable",
                    human: "Er is iets fout met de tariefinstellingen van "+this.group.settings.name+", waardoor je nu niet kan inschrijven. Neem contact op met een beheerder en vraag de tariefinstellingen na te kijken."
                })
            )
        } else {
            const groupPrice = this.group.settings.prices.find(p => p.id === this.groupPrice.id)
            if (!groupPrice) {
                errors.addError(
                    new SimpleError({
                        code: "product_unavailable",
                        message: "Product unavailable",
                        human: "Eén of meerdere tarieven van "+this.group.settings.name+" zijn niet meer beschikbaar",
                        meta: {recoverable: true}
                    })
                )
            } else {
                this.groupPrice = groupPrice
            }
        }

        // Check all options
        const remainingMenus = this.group.settings.optionMenus.slice()

        for (const o of this.options) {
            let index = remainingMenus.findIndex(m => m.id === o.optionMenu.id)
            if (index == -1) {
                // Check if it has a multiple choice one
                index = this.group.settings.optionMenus.findIndex(m => m.id === o.optionMenu.id)
                errors.addError(new SimpleError({
                    code: "option_menu_unavailable",
                    message: "Option menu unavailable",
                    human: "Eén of meerdere keuzemogelijkheden van "+this.group.settings.name+" zijn niet meer beschikbaar",
                    meta: {recoverable: true}
                }))
                continue
            }

            const menu = remainingMenus[index]
            if (!menu.multipleChoice) {
                // Already used: not possible to add another
                remainingMenus.splice(index, 1)[0]
            }
            
            const option = menu.options.find(m => m.id === o.option.id)

            if (!option) {
                errors.addError(new SimpleError({
                    code: "option_unavailable",
                    message: "Option unavailable",
                    human: "Eén of meerdere keuzemogelijkheden van "+this.group.settings.name+" zijn niet meer beschikbaar",
                    meta: {recoverable: true}
                }))
                continue
            }

            // Update to latest data
            o.optionMenu = menu
            o.option = option
        }

        if (remainingMenus.filter(m => !m.multipleChoice).length > 0) {
            errors.addError(
                new SimpleError({
                    code: "missing_menu",
                    message: "Missing menu's "+remainingMenus.filter(m => !m.multipleChoice).map(m => m.name).join(", "),
                    human: "Er zijn nieuwe keuzemogelijkheden voor "+this.group.settings.name+" waaruit je moet kiezen",
                    meta: {recoverable: true}
                })
            )
        }

        errors.throwIfNotEmpty()
    }

    willReplace(registrationId: string) {
        return this.replaceRegistrations.some(rr => rr.id === registrationId)
    }

    isAlreadyRegistered() {
        return !!this.member.member.registrations.find(r => !this.willReplace(r.id) && r.groupId === this.group.id && r.registeredAt !== null && r.deactivatedAt === null)
    }
    
    hasReachedCategoryMaximum(): boolean {
        if (this.group.type !== GroupType.Membership) {
            return false;
        }

        const parents = this.group.getParentCategories(this.organization.period.settings.categories, false)
    
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.member.patchedMember.registrations.filter(r => {
                    if (!this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
                        return true;
                    }
                    return false
                }).length
    
                const waiting = this.checkout.cart.items.filter(item => {
                    return item.member.member.id === this.member.member.id && parent.groupIds.includes(item.group.id) && item.group.id !== this.group.id
                }).length
                if (count + waiting >= parent.settings.maximumRegistrations) {
                    return true
                }
            }
        }
        return false
    }

    isInvited() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && r.registeredAt === null && r.canRegister)
    }

    doesMeetRequireGroupIds() {
        if (this.group.settings.requireGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                return !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && this.group.settings.requireGroupIds.includes(r.groupId)
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireGroupIds.includes(item.group.id))) {
                return false;
            }
        }

        if (this.group.settings.requireDefaultAgeGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                return !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && r.group.defaultAgeGroupId && this.group.settings.requireDefaultAgeGroupIds.includes(r.group.defaultAgeGroupId)
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && item.group.defaultAgeGroupId && this.group.settings.requireDefaultAgeGroupIds.includes(item.group.defaultAgeGroupId))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequireOrganizationIds() {
        if (this.group.settings.requireOrganizationIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                return !this.willReplace(r.id) && r.group.type === GroupType.Membership && this.group.settings.requireOrganizationIds.includes(r.organizationId) && r.registeredAt !== null && r.deactivatedAt === null
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireOrganizationIds.includes(item.organization.id))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequireOrganizationTags() {
        if (this.group.settings.requireOrganizationTags.length > 0) {
            const hasOrganization = this.member.filterOrganizations({currentPeriod: true, types: [GroupType.Membership]}).find(organization => {
                return organization.meta.matchTags(this.group.settings.requireOrganizationTags)
            });

            if (!hasOrganization && !this.checkout.cart.items.find(item => item.member.id === this.member.id && item.organization.meta.matchTags(this.group.settings.requireOrganizationTags))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequirePlatformMembershipOn() {
        if (this.group.settings.requirePlatformMembershipOn !== null) {
            const requirePlatformMembershipOn = this.group.settings.requirePlatformMembershipOn
            return !!this.member.patchedMember.platformMemberships.find(m => m.isActive(requirePlatformMembershipOn))
        }
        return true;
    }

    isExistingMemberOrFamily() {
        return this.member.isExistingMember(this.group.organizationId) || (this.group.settings.priorityForFamily && !!this.family.members.find(f => f.isExistingMember(this.group.organizationId)))
    }

    get description() {
        const descriptions: string[] = []

        if (this.replaceRegistrations.length > 0) {
            for (const registration of this.replaceRegistrations) {
                descriptions.push("Verplaatsen vanaf " + registration.group.settings.name)
            }
        }

        if (this.getFilteredPrices().length > 1) {
            descriptions.push(this.groupPrice.name)
        }
        
        for (const option of this.options) {
            descriptions.push(option.optionMenu.name + ': ' + option.option.name + (option.option.allowAmount ? ` x ${option.amount}` : ""))
        }

        return descriptions.filter(d => !!d).join("\n")
    }

    shouldUseWaitingList() {
        if (this.group.settings.waitingListType === WaitingListType.All) {
            return true;
        }
        const existingMember = this.isExistingMemberOrFamily()

        if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
            return true;
        }

        if (this.group.waitingList) {
            if (this.hasReachedGroupMaximum()) {
                return true;
            }
        }
        return false
    }

    hasReachedGroupMaximum() {
        const available = this.group.settings.availableMembers
        if (available !== null) {
            const count = this.checkout.cart.items.filter(item => item.group.id === this.group.id && item.member.member.id !== this.member.member.id && !item.waitingList).length
            if (count >= available) {
                // Check if we have a reserved spot
                const now = new Date()
                const reserved = this.member.member.registrations.find(r => r.groupId === this.group.id && r.reservedUntil && r.reservedUntil > now && !r.waitingList && r.registeredAt === null && r.cycle === this.group.cycle)
                if (!reserved) {
                    return true
                }
            }
        }
        return false;
    }

    get validationError() {
        try {
            this.validate()
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return e.getHuman();
            }
            throw e;
        }
        return null;
    }

    get validationWarning() {
        if (this.validationError) {
            return null;
        }

        if (!this.member.family.checkout.isAdminFromSameOrganization) {
            // Warnings are only for admins
            return null;
        }

        try {
            this.validate({warnings: true})
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return e.getHuman();
            }
            throw e;
        }
        return null;
    }

    get isValid() {
        return this.validationError === null
    }

    validate(options?: {warnings?: boolean}) {
        this.cartError = null;
        this.refresh(this.group)
        const checkout = this.member.family.checkout;
        const admin = checkout.isAdminFromSameOrganization && !options?.warnings
        
        if (this.group.organizationId !== this.organization.id) {
            throw new Error("Group and organization do not match in RegisterItem.validate")
        }

        if (checkout.asOrganizationId && !checkout.isAdminFromSameOrganization  && !this.group.settings.allowRegistrationsByOrganization) {
            throw new SimpleError({
                code: "as_organization_disabled",
                message: "allowRegistrationsByOrganization disabled",
                human: "Inschrijvingen door organisaties zijn niet toegestaan voor "+this.group.settings.name,
            })
        }

        for (const registration of this.replaceRegistrations) {
            // todo: check if you are allowed to move
            if (registration.memberId !== this.member.id) {
                throw new SimpleError({
                    code: "invalid_move",
                    message: "Invalid member in replaceRegistration",
                    human: "Je wilt een inschrijving verplaatsen van een ander lid in ruil voor een ander lid. Dit is niet toegestaan.",
                    field: "replaceRegistrations"
                })
            }

            if (registration.group.organizationId !== this.organization.id) {
                throw new SimpleError({
                    code: "invalid_move",
                    message: "Invalid organization in replaceRegistration",
                    human: "Je wilt een inschrijving verplaatsen van een andere organisatie. Dit is niet toegestaan.",
                    field: "replaceRegistrations"
                })
            }

            if (!admin) {
                throw new SimpleError({
                    code: "invalid_move",
                    message: "Not allowed to move registrations",
                    human: "Enkel beheerders kunnen inschrijvingen verplaatsen.",
                    field: "replaceRegistrations"
                })
            }
        }

        // Already registered
        if (this.isAlreadyRegistered()) {
            throw new SimpleError({
                code: "already_registered",
                message: "Already registered",
                human: `${this.member.member.firstName} is al ingeschreven voor ${this.group.settings.name}`
            })
        }

        if (this.hasReachedCategoryMaximum()) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            throw new SimpleError({
                code: "maximum_reached",
                message: "Maximum reached",
                human: `Je kan niet meer inschrijven voor ${this.group.settings.name} omdat ${this.member.patchedMember.name} al ingeschreven is voor een groep die je niet kan combineren.`
            })
        }

        // Check if we have an invite (doesn't matter if registrations are closed)
        if (this.isInvited()) {
            return
        }

        if (!admin) {
            if (this.group.notYetOpen) {
                throw new SimpleError({
                    code: "not_yet_open",
                    message: "Not yet open",
                    human: `De inschrijvingen voor ${this.group.settings.name} zijn nog niet geopend.`
                })
            }

            if (this.group.closed) {
                throw new SimpleError({
                    code: "closed",
                    message: "Closed",
                    human: `De inschrijvingen voor ${this.group.settings.name} zijn gesloten.`
                })
            }

            // Check if it fits
            if (this.member.member.details) {
                if (!this.member.member.details.doesMatchGroup(this.group)) {
                    const error = this.member.member.details.getMatchingError(this.group);
                    throw new SimpleError({
                        code: "not_matching",
                        message: "Not matching: memberDetails",
                        human: error?.description ?? `${this.member.patchedMember.name} voldoet niet aan de voorwaarden om in te schrijven voor deze groep.`
                    })
                }
            }
        

            // Check if registrations are limited
            if (!this.doesMeetRequireGroupIds()) {
                throw new SimpleError({
                    code: "not_matching",
                    message: "Not matching: requireGroupIds",
                    human: `${this.member.patchedMember.name} voldoet niet aan de voorwaarden om in te schrijven voor deze groep (verplichte inschrijving bij leeftijdsgroep).`
                })
            }

            if (!this.doesMeetRequireOrganizationIds()) {
                throw new SimpleError({
                    code: "not_matching",
                    message: "Not matching: requireOrganizationIds",
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige actieve inschrijving  (verplichte inschrijving bij lokale groep).`
                })
            }

            if (!this.doesMeetRequireOrganizationTags()) {
                throw new SimpleError({
                    code: "not_matching",
                    message: "Not matching: requireOrganizationIds",
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige actieve inschrijving  (verplichte inschrijving in regio).`
                })
            }

            if (!this.doesMeetRequirePlatformMembershipOn()) {
                throw new SimpleError({
                    code: "not_matching",
                    message: "Not matching: requirePlatformMembershipOn",
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige aansluiting (en dus verzekering) bij de koepel`
                })
            }

            const existingMember = this.isExistingMemberOrFamily()

            // Pre registrations?
            if (this.group.activePreRegistrationDate) {
                if (!existingMember) {
                    throw new SimpleError({
                        code: "pre_registrations",
                        message: "Pre registrations",
                        human: "Momenteel zijn de voorinschrijvingen nog bezig voor "+this.group.settings.name+". Dit is enkel voor bestaande leden"+(this.group.settings.priorityForFamily ? " en hun broers/zussen" : "")+"."
                    })
                }
            }

            if (this.shouldUseWaitingList()) {
                throw new SimpleError({
                    code: "waiting_list_required",
                    message: "Waiting list required",
                    human: `${this.member.member.firstName} kan momenteel enkel voor de wachtlijst van ${this.group.settings.name} inschrijven.`,
                    meta: {recoverable: true}
                })
            }

            if (this.hasReachedGroupMaximum()) {
                throw new SimpleError({
                    code: "maximum_reached",
                    message: "Maximum reached",
                    human: this.group.waitingList ? `De inschrijvingen voor ${this.group.settings.name} zijn volzet. Je kan wel nog inschrijven voor de wachtlijst.` : `De inschrijvingen voor ${this.group.settings.name} zijn volzet. `,
                    meta: {recoverable: true}
                })
            }
        }

    }

    static fromId(idRegisterItem: IDRegisterItem, context: RegisterContext) {
        const member = context.members.find(m => m.member.id === idRegisterItem.memberId)
        if (!member) {
            throw new Error("Member not found: " + idRegisterItem.memberId)
        }

        const organization = context.organizations.find(o => o.id === idRegisterItem.organizationId)
        if (!organization) {
            throw new Error("Organization not found: " + idRegisterItem.organizationId)
        }

        const group = context.groups.find(g => g.id === idRegisterItem.groupId)
        if (!group) {
            throw new Error("Group not found: " + idRegisterItem.groupId)
        }

        const replaceRegistrations: Registration[] = []

        for (const registrationId of idRegisterItem.replaceRegistrationIds) {
            const registration = member.patchedMember.registrations.find(r => r.id === registrationId)
            if (!registration) {
                throw new Error("Registration not found: " + registrationId)
            }
            replaceRegistrations.push(registration)
        }

        return new RegisterItem({
            id: idRegisterItem.id,
            member,
            group,
            organization,
            groupPrice: idRegisterItem.groupPrice,
            options: idRegisterItem.options,
            replaceRegistrations
        })
    }

    get paymentConfiguration() {
        if (this.calculatedPrice === 0) {
            return null;
        }
        return this.organization.meta.registrationPaymentConfiguration
    }

    /**
     * Returns the stock that will be taken (or freed if negative) by all the register items before this item
     * and with the removed registrations freed up, so this can be negative
     */
    getCartPendingStockReservations() {
        const deleteRegistrations = [
            ...this.checkout.cart.deleteRegistrations.filter(r => r.groupId === this.group.id),
            ...this.replaceRegistrations.filter(r => r.groupId === this.group.id)
        ]

        const cartIndex = this.checkout.cart.items.findIndex(i => i.id === this.id)
        const itemsBefore = this.checkout.cart.items.slice(0, cartIndex === -1 ? undefined : cartIndex)

        return StockReservation.removed(
            itemsBefore.flatMap(i => i.getPendingStockReservations()),  // these will be removed
            deleteRegistrations.flatMap(r => r.stockReservations) // these will be freed up
        )
    }


    /**
     * Stock that will be taken or removed by this item
     */
    getPendingStockReservations() {
        const base = [
            // Global level stock reservations (stored in each group)
            StockReservation.create({
                objectId: this.group.id,
                objectType: 'Group',
                amount: 1,
                children: [
                    // Group level stock reservatiosn (stored in the group)

                    StockReservation.create({
                        objectId: this.groupPrice.id,
                        objectType: 'GroupPrice',
                        amount: 1
                    }),
                    ...this.options.map(o => {
                        return StockReservation.create({
                            objectId: o.option.id,
                            objectType: 'GroupOption',
                            amount: o.amount
                        })
                    })
                ]
            })
        ];

        const freed = this.replaceRegistrations.flatMap(r =>r.stockReservations)
        return StockReservation.removed(base, freed);
    }
}
