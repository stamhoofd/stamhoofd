import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors"
import { Formatter } from "@stamhoofd/utility"
import { Group } from "../../Group"
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

        if (this.group.settings.prices.length === 0) {
            throw new Error("Group has no prices")
        }

        this.groupPrice = data.groupPrice ?? this.group.settings.prices[0]
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

    get showItemView() {
        return this.shouldUseWaitingList() || this.group.settings.prices.length > 1 || this.group.settings.optionMenus.length > 0
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

    getFilteredPrices(options: {admin?: boolean}) {
        return this.group.settings.prices.filter(p => {
            if (p.hidden && !options.admin) {
                return false
            }
            return true
        })
    }

    getFilteredOptionMenus(options: {admin?: boolean}) {
        return this.group.settings.optionMenus.filter(p => {
            return this.getFilteredOptions(p, options).length > 0
        })
    }

    getFilteredOptions(menu: GroupOptionMenu, options: {admin?: boolean}) {
        return menu.options.filter(p => {
            if (p.hidden && !options.admin) {
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

        const item = new RegisterItem({
            member,
            group,
            organization
        });
        return item;
    }

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(group: Group) {
        this.group = group
        
        const errors = new SimpleErrors()

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
        const parents = this.group.getParentCategories(this.organization.period.settings.categories, false)
    
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.member.member.registrations.filter(r => {
                    if (r.registeredAt !== null && !r.waitingList && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
                        // Check cycle (only count current periods, not previous periods)
                        const g = this.organization.groups.find(gg => gg.id === r.groupId)
                        return g && g.cycle === r.cycle
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
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && r.waitingList && r.canRegister && r.cycle === this.group.cycle)
    }

    doesMeetRequireGroupIds() {
        if (this.group.settings.requireGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.requireGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => this.group.settings.requireGroupIds.includes(item.group.id) && item.member.member.id === this.member.member.id && !item.waitingList)) {
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

    validate() {
        this.cartError = null;
        this.refresh(this.group)

        if (this.group.organizationId !== this.organization.id) {
            throw new Error("Group and organization do not match in RegisterItem.validate")
        }

        if (!this.checkout.cart.contains(this)) {
            if (!this.checkout.cart.canAdd(this)) {
                throw new SimpleError({
                    code: "already_registered",
                    message: "Already registered",
                    human: `Reken jouw winkelmandje eerst af. Het is niet mogelijk om deze inschrijving samen af te rekenen omdat het inschrijvingsgeld aan een andere partij betaald moet worden.`
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
                human: `Je kan niet meer inschrijven voor ${this.group.settings.name} omdat je al ingeschreven bent of aan het inschrijven bent voor een groep die je niet kan combineren.`
            })
        }

        // Check if we have an invite (doesn't matter if registrations are closed)
        if (this.isInvited()) {
            return
        }

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
                    message: "Not matching",
                    human: error?.description ?? "Je voldoet niet aan de voorwaarden om in te schrijven voor deze groep."
                })
            }
        }

         // Check if registrations are limited
        if (!this.doesMeetRequireGroupIds()) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human:  "Inschrijving bij "+Formatter.joinLast(this.group.settings.requireGroupIds.map(id => this.organization.groups.find(g => g.id === id)?.settings.name ?? "Onbekend"), ", ", " of ")+" is verplicht voor je kan inschrijven voor "+this.group.settings.name,
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

        if (!this.waitingList && this.shouldUseWaitingList()) {
            throw new SimpleError({
                code: "waiting_list_required",
                message: "Waiting list required",
                human: `${this.member.member.firstName} kan momenteel enkel voor de wachtlijst van ${this.group.settings.name} inschrijven.`
            })
        }

        if (!this.waitingList) {
            if (!this.group.waitingList) {
                if (this.hasReachedGroupMaximum()) {
                    throw new SimpleError({
                        code: "maximum_reached",
                        message: "Maximum reached",
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet. Je kan wel nog inschrijven voor de wachtlijst.`
                    })
                }
            } else {
                if (this.hasReachedGroupMaximum()) {
                    throw new SimpleError({
                        code: "maximum_reached",
                        message: "Maximum reached",
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet.`
                    })
                }
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
