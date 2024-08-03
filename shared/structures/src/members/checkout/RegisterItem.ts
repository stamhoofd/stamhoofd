import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors"
import { Formatter } from "@stamhoofd/utility"
import { Group, GroupType } from "../../Group"
import { GroupOption, GroupOptionMenu, GroupPrice, WaitingListType } from "../../GroupSettings"
import { PlatformMember, PlatformFamily } from "../PlatformMember"
import { RegisterItemWithPrice } from "./OldRegisterCartPriceCalculator"
import { RegisterContext } from "./RegisterCheckout"
import { v4 as uuidv4 } from "uuid";
import { Registration } from "../Registration"
import { Organization } from "../../Organization"

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

    hydrate(context: RegisterContext) {
        return RegisterItem.fromId(this, context)
    }
}

export class RegisterItem implements RegisterItemWithPrice {
    id: string;
    
    member: PlatformMember
    group: Group
    organization: Organization

    groupPrice: GroupPrice;
    options: RegisterItemOption[] = []
    calculatedPrice = 0

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
            organization
        })
    }

    constructor(data: {
        id?: string, 
        member: PlatformMember, 
        group: Group, 
        organization: Organization,
        groupPrice?: GroupPrice,
        options?: RegisterItemOption[]
    }) {
        this.id = data.id ?? uuidv4()
        this.member = data.member
        this.group = data.group

        this.groupPrice = data.groupPrice ?? this.group.settings.prices[0] ?? GroupPrice.create({name: 'Ongeldig tarief', id: ''})
        this.organization = data.organization
        this.options = data.options ?? []

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
        return this.shouldUseWaitingList() || this.group.settings.prices.length > 1 || this.group.settings.optionMenus.length > 0 || (!this.isInCart && !this.isValid)
    }

    calculatePrice() {
        this.calculatedPrice = this.groupPrice.price.forMember(this.member)

        for (const option of this.options) {
            this.calculatedPrice += option.option.price.forMember(this.member) * option.amount
        }
    }

    clone() {
        return new RegisterItem({
            id: this.id,
            member: this.member,
            group: this.group,
            organization: this.organization,
            groupPrice: this.groupPrice.clone(),
            options: this.options.map(o => o.clone())
        })
    }

    copyFrom(item: RegisterItem) {
        this.groupPrice = item.groupPrice.clone()
        this.options = item.options.map(o => o.clone())
        this.calculatedPrice = item.calculatedPrice
    }

    getFilteredPrices() {
        return this.group.settings.prices.filter(p => {
            if (p.hidden && !this.checkout.isAdminFromSameOrganization) {
                return false
            }
            return true
        })
    }

    getFilteredOptionMenus() {
        return this.group.settings.optionMenus.filter(p => {
            return this.getFilteredOptions(p).length > 0
        })
    }

    getFilteredOptions(menu: GroupOptionMenu) {
        return menu.options.filter(p => {
            if (p.hidden && !this.checkout.isAdminFromSameOrganization) {
                return false
            }
            return true
        })
    }

    convert(): IDRegisterItem {
        return IDRegisterItem.create({
            id: this.id,
            memberId: this.member.member.id,
            groupId: this.group.id,
            organizationId: this.organization.id,
            groupPrice: this.groupPrice,
            options: this.options
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

    static defaultFor(member: PlatformMember, group: Group, organization: Organization) {
        if (group.organizationId !== organization.id) {
            throw new Error("Group and organization do not match in RegisterItem.defaultFor")
        }

        let item = new RegisterItem({
            member,
            group,
            organization
        });

        if (item.shouldUseWaitingList() && group.waitingList) {
            group = group.waitingList
            item = RegisterItem.defaultFor(member, group, organization);
        }

        return item;
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
                        human: "Eén of meerdere tarieven van "+this.group.settings.name+" zijn niet meer beschikbaar"
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
                    human: "Eén of meerdere keuzemogelijkheden van "+this.group.settings.name+" zijn niet meer beschikbaar"
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
                    human: "Eén of meerdere keuzemogelijkheden van "+this.group.settings.name+" zijn niet meer beschikbaar"
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
                    human: "Er zijn nieuwe keuzemogelijkheden voor "+this.group.settings.name+" waaruit je moet kiezen"
                })
            )
        }

        errors.throwIfNotEmpty()
    }

    isAlreadyRegistered() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && (this.waitingList || r.registeredAt !== null) && r.deactivatedAt === null && r.waitingList === this.waitingList && r.cycle === this.group.cycle)
    }
    
    hasReachedCategoryMaximum(): boolean {
        if (this.group.type !== GroupType.Membership) {
            return false;
        }

        const parents = this.group.getParentCategories(this.organization.period.settings.categories, false)
    
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.member.patchedMember.registrations.filter(r => {
                    if (r.registeredAt !== null && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
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
                return this.group.settings.requireGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireGroupIds.includes(item.group.id))) {
                return false;
            }
        }
        return true;
    }

    isExistingMemberOrFamily() {
        return this.member.isExistingMember(this.group.organizationId) || (this.group.settings.priorityForFamily && !!this.family.members.find(f => f.isExistingMember(this.group.organizationId)))
    }

    get rowLabel(): string|null {
        if (this.isInvited()) {
            return 'Uitnodiging'
        }

        return null
    }

    get infoDescription(): string|null {
        if (this.isInvited()) {
            return 'Je bent uitgenodigd om in te schrijven voor deze groep'
        }

        if (this.waitingList) {
            if (this.group.settings.waitingListType === WaitingListType.All) {
                return 'Je kan enkel inschrijven voor de wachtlijst'
            }
            const existingMember = this.isExistingMemberOrFamily()

            if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
                return 'Nieuwe leden kunnen enkel inschrijven voor de wachtlijst'
            }

            if (this.group.waitingList) {
                if (this.hasReachedGroupMaximum()) {
                    return 'De inschrijvingen zijn volzet, je kan enkel inschrijven voor de wachtlijst'
                }
            }
        }

        return null;
    }

    get description() {
        const descriptions: string[] = []

        if (this.getFilteredPrices().length > 1) {
            descriptions.push(this.groupPrice.name)
        }
        
        for (const option of this.options) {
            descriptions.push(option.optionMenu.name + ': ' + option.option.name + (option.option.allowAmount ? ` x ${option.amount}` : ""))
        }

        return descriptions.filter(d => !!d).join("\n")
    }

    shouldUseWaitingList() {
        const checkout = this.member.family.checkout;

        if (checkout.isAdminFromSameOrganization) {
            // Admins can skip the waiting lists if they register internal members for their own groups
            return false;
        }

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
        }

         // Check if registrations are limited
        if (!this.doesMeetRequireGroupIds() && !admin) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching: requireGroupIds",
                human: `${this.member.patchedMember.name} voldoet niet aan de voorwaarden om in te schrijven voor deze groep.`
            })
        }

        const existingMember = this.isExistingMemberOrFamily()

        // Pre registrations?
        if (this.group.activePreRegistrationDate && !admin) {
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

        if (!this.group.waitingList) {
            if (this.hasReachedGroupMaximum()) {
                throw new SimpleError({
                    code: "maximum_reached",
                    message: "Maximum reached",
                    human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet. `,
                    meta: {recoverable: true}
                })
            }
        } else {
            if (this.hasReachedGroupMaximum()) {
                throw new SimpleError({
                    code: "maximum_reached",
                    message: "Maximum reached",
                    human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet. Je kan wel nog inschrijven voor de wachtlijst.`,
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

        return new RegisterItem({
            id: idRegisterItem.id,
            member,
            group,
            organization,
            groupPrice: idRegisterItem.groupPrice,
            options: idRegisterItem.options
        })
    }

    get paymentConfiguration() {
        if (this.calculatedPrice === 0) {
            return null;
        }
        return this.organization.meta.registrationPaymentConfiguration
    }
}
