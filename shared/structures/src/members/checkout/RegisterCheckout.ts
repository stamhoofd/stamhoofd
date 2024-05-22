import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Group } from "../../Group";
import { WaitingListType } from "../../GroupSettings";
import { PriceBreakdown } from "../../PriceBreakdown";
import { PlatformFamily, PlatformMember } from "../PlatformMember";
import { OldRegisterCartPriceCalculator, RegisterItemWithPrice } from "./OldRegisterCartPriceCalculator";


export type RegisterContext = {
    family: PlatformFamily
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

    @field({ decoder: BooleanDecoder })
    waitingList: boolean

    hydrate(context: RegisterContext) {
        return RegisterItem.fromId(this, context.family)
    }
}

export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    hydrate(context: RegisterContext) {
        const cart = new RegisterCart()
        cart.items = this.items.map(i => i.hydrate(context))
        return cart
    }
}

export class IDRegisterCheckout extends AutoEncoder {
    @field({ decoder: IDRegisterCart })
    cart: IDRegisterCart = IDRegisterCart.create({})

    @field({ decoder: IntegerDecoder })
    administrationFee = 0

    hydrate(context: RegisterContext) {
        const checkout = new RegisterCheckout()
        checkout.cart = this.cart.hydrate(context)
        checkout.administrationFee = this.administrationFee
        return checkout
    }
}

export class RegisterItem implements RegisterItemWithPrice {
    id: string;
    member: PlatformMember
    group: Group
    waitingList = false
    calculatedPrice = 0

    constructor(data: {id?: string, member: PlatformMember, group: Group, waitingList: boolean}) {
        this.id = data.id ?? uuidv4()
        this.member = data.member
        this.group = data.group
        this.waitingList = data.waitingList
    }

    convert(): IDRegisterItem {
        return IDRegisterItem.create({
            id: this.id,
            memberId: this.member.member.id,
            groupId: this.group.id,
            organizationId: this.group.organizationId,
            waitingList: this.waitingList
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

    static defaultFor(member: PlatformMember, group: Group) {
        const item = new RegisterItem({
            member,
            group,
            waitingList: false
        });
        item.waitingList = item.shouldUseWaitingList()
        return item;
    }

    get organization() {
        return this.member.organizations.find(o => o.id === this.group.organizationId)!
    }

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh() {
        // todo
    }

    isAlreadyRegistered() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && (this.waitingList || r.registeredAt !== null) && r.deactivatedAt === null && r.waitingList === this.waitingList && r.cycle === this.group.cycle)
    }
    
    hasReachedCategoryMaximum(): boolean {
        const parents = this.group.getParentCategories(this.organization.meta.categories, false)
    
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

    doesMeetRequirePreviousGroupIds() {
        if (this.group.settings.requirePreviousGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.requirePreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            });

            if (!hasGroup) {
                return false;
            }
        }
        return true;
    }

    doesMeetPreventPreviousGroupIds() {
        if (this.group.settings.preventPreviousGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.preventPreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            });

            if (hasGroup) {
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

            if (this.group.settings.waitingListIfFull) {
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

        if (this.group.settings.waitingListIfFull) {
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

        if (!this.doesMeetPreventPreviousGroupIds()) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human: `Je voldoet niet aan de voorwaarden om in te schrijven voor ${this.group.settings.name}.`
            })
        }

        if (!this.doesMeetRequirePreviousGroupIds()) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human: `Je voldoet niet aan de voorwaarden om in te schrijven voor ${this.group.settings.name}.`
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
            if (!this.group.settings.waitingListIfFull) {
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

    static fromId(idRegisterItem: IDRegisterItem, family: PlatformFamily) {
        const member = family.members.find(m => m.member.id === idRegisterItem.memberId)
        if (!member) {
            throw new Error("Member not found")
        }

        const organization = member.organizations.find(o => o.id === idRegisterItem.organizationId)
        if (!organization) {
            throw new Error("Organization not found")
        }

        const group = organization.groups.find(g => g.id === idRegisterItem.groupId)
        if (!group) {
            throw new Error("Group not found")
        }

        return new RegisterItem({
            id: idRegisterItem.id,
            member,
            group,
            waitingList: idRegisterItem.waitingList
        })
    }

    get paymentConfiguration() {
        if (this.calculatedPrice === 0) {
            return null;
        }
        return this.organization.meta.registrationPaymentConfiguration
    }
}

export class RegisterCart {
    items: RegisterItem[] = []

    calculatePrices() {
        OldRegisterCartPriceCalculator.calculatePrices(
            this.items, 
            this.items.map(i => i.member.patchedMember), 
            this.items.map(i => i.group), 
            this.items.flatMap(i => i.organization.meta.categories) 
        )
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert())
        })
    }

    add(item: RegisterItem) {
        if (this.contains(item)) {
            return;
        }
        this.items.push(item)
    }

    canAdd(item: RegisterItem) {
        if (this.contains(item)) {
            return false;
        }
        if (this.paymentConfiguration && item.paymentConfiguration && item.paymentConfiguration !== this.paymentConfiguration) {
            return false;
        }
        return true;
    }

    contains(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id) {
                return true;
            }
        }
        return false;
    }

    remove(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id) {
                this.items.splice(i, 1);
                break;
            }
        }
    }

    get isEmpty() {
        return this.items.length === 0
    }

    get count() {
        return this.items.length
    }

    get price() {
        return this.items.reduce((total, item) => item.calculatedPrice + total, 0)
    }

    get paymentConfiguration() {
        for (const item of this.items) {
            const organization = item.organization

            return organization.meta.registrationPaymentConfiguration
        }

        return null;
    }
}

export class RegisterCheckout{
    cart = new RegisterCart()
    administrationFee = 0;

    convert(): IDRegisterCheckout {
        return IDRegisterCheckout.create({
            cart: this.cart.convert(),
            administrationFee: this.administrationFee
        })
    }

    get paymentConfiguration() {
        return this.cart.paymentConfiguration
    }

    updatePrices() {
        this.cart.calculatePrices()
        this.administrationFee = this.paymentConfiguration?.administrationFee.calculate(this.cart.price) ?? 0
    }

    validate() {
        // todo
    }

    get totalPrice() {
        return Math.max(0, this.cart.price + this.administrationFee)
    }

    get priceBreakown(): PriceBreakdown {
        const all = [
            {
                name: 'Administratiekost',
                price: this.administrationFee
            },
        ].filter(a => a.price !== 0)

        if (all.length > 0) {
            all.unshift({
                name: 'Subtotaal',
                price: this.cart.price
            })
        }

        return [
            ...all,
            {
                name: 'Totaal',
                price: this.totalPrice
            }
        ];
    }

}
