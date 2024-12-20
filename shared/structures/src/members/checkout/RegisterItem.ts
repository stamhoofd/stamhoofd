import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../../Group.js';
import { GroupOption, GroupOptionMenu, GroupPrice, WaitingListType } from '../../GroupSettings.js';
import { GroupType } from '../../GroupType.js';
import { Organization } from '../../Organization.js';
import { PriceBreakdown } from '../../PriceBreakdown.js';
import { StockReservation } from '../../StockReservation.js';
import { PlatformMember } from '../PlatformMember.js';
import { Registration } from '../Registration.js';
import { RegisterContext } from './RegisterCheckout.js';
import { StamhoofdFilter } from '../../filters/StamhoofdFilter.js';
import { compileToInMemoryFilter } from '../../filters/InMemoryFilter.js';
import { registerItemInMemoryFilterCompilers } from '../../filters/inMemoryFilterDefinitions.js';
import { RecordSettings } from '../records/RecordSettings.js';
import { RecordAnswer, RecordAnswerDecoder } from '../records/RecordAnswer.js';
import { RecordCategory } from '../records/RecordCategory.js';
import { PlatformMembershipTypeBehaviour } from '../../Platform.js';

export class RegisterItemOption extends AutoEncoder {
    @field({ decoder: GroupOption })
    option: GroupOption;

    @field({ decoder: GroupOptionMenu })
    optionMenu: GroupOptionMenu;

    @field({ decoder: IntegerDecoder })
    amount = 1;
}

export class IDRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder })
    groupId: string;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: GroupPrice })
    groupPrice: GroupPrice;

    @field({ decoder: new ArrayDecoder(RegisterItemOption) })
    options: RegisterItemOption[] = [];

    @field({ decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder), version: 338 })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    replaceRegistrationIds: string[] = [];

    @field({ decoder: BooleanDecoder, version: 354 })
    trial = false;

    @field({ decoder: DateDecoder, nullable: true, version: 354 })
    customStartDate: Date | null = null;

    hydrate(context: RegisterContext) {
        return RegisterItem.fromId(this, context);
    }
}

export class RegisterItem {
    id: string;

    member: PlatformMember;
    group: Group;
    organization: Organization;
    trial = false;

    groupPrice: GroupPrice;
    options: RegisterItemOption[] = [];
    recordAnswers: Map<string, RecordAnswer> = new Map();
    customStartDate: Date | null = null;

    /**
     * Price for the new registration
     */
    calculatedPrice = 0;

    /**
     * Price for the new registration that is due later
     */
    calculatedPriceDueLater = 0;

    /**
     * Refund for the replaced registrations
     */
    calculatedRefund = 0;

    /**
     * These registrations will be replaced as part of this new registration (moving or updating a registration is possible this way)
     */
    replaceRegistrations: Registration[] = [];

    /**
     * Show an error in the cart for recovery
     */
    cartError: SimpleError | SimpleErrors | null = null;

    /**
     * @deprecated
     */
    get waitingList() {
        return false;
    }

    static defaultFor(member: PlatformMember, group: Group, organization: Organization) {
        if (group.organizationId !== organization.id) {
            throw new Error('Group and organization do not match in RegisterItem.defaultFor');
        }

        const item = new RegisterItem({
            member,
            group,
            organization,
        });

        return item;
    }

    constructor(data: {
        id?: string;
        member: PlatformMember;
        group: Group;
        organization: Organization;
        groupPrice?: GroupPrice;
        options?: RegisterItemOption[];
        recordAnswers?: Map<string, RecordAnswer>;
        replaceRegistrations?: Registration[];
        cartError?: SimpleError | SimpleErrors | null;
        calculatedPrice?: number;
        calculatedRefund?: number;
        calculatedPriceDueLater?: number;
        trial?: boolean;
        customStartDate?: Date | null;
    }) {
        this.id = data.id ?? uuidv4();
        this.member = data.member;
        this.group = data.group;

        if (!data.groupPrice) {
            const prices = this.getFilteredPrices();
            for (const price of prices) {
                const stock = price.getRemainingStock(this);
                if (stock !== 0) {
                    this.groupPrice = price;
                    break;
                }
            }

            if (!this.groupPrice) {
                // Probably all sold out
                // Select the first one anyway
                this.groupPrice = prices[0] ?? GroupPrice.create({ name: 'Ongeldig tarief', id: '' });
            }
        }
        else {
            this.groupPrice = data.groupPrice;
        }

        this.organization = data.organization;
        this.options = data.options ?? [];
        this.recordAnswers = data.recordAnswers ?? new Map();
        this.replaceRegistrations = data.replaceRegistrations ?? [];
        this.cartError = data.cartError ?? null;
        this.calculatedPrice = data.calculatedPrice ?? 0;
        this.calculatedRefund = data.calculatedRefund ?? 0;
        this.calculatedPriceDueLater = data.calculatedPriceDueLater ?? 0;
        this.trial = data.trial ?? false;

        // Select all defaults
        for (const optionMenu of this.group.settings.optionMenus) {
            if (!optionMenu.multipleChoice) {
                if (this.options.find(o => o.optionMenu.id === optionMenu.id)) {
                    continue;
                }

                let added = false;
                const options = this.getFilteredOptions(optionMenu);

                for (const option of options) {
                    const stock = option.getRemainingStock(this);
                    if (stock === 0) {
                        continue;
                    }

                    this.options.push(
                        RegisterItemOption.create({
                            option,
                            optionMenu: optionMenu,
                            amount: 1,
                        }),
                    );
                    added = true;
                    break;
                }

                if (!added && options.length > 0) {
                    // Add the first (this one is sold out, but still required for correct error handling)
                    this.options.push(
                        RegisterItemOption.create({
                            option: options[0],
                            optionMenu: optionMenu,
                            amount: 1,
                        }),
                    );
                }
            }
        }

        if (data.trial === undefined) {
            this.trial = this.canHaveTrial;
        }

        if (data.customStartDate !== undefined) {
            this.customStartDate = data.customStartDate;
        }
    }

    static fromRegistration(registration: Registration, member: PlatformMember, organization: Organization) {
        return new RegisterItem({
            id: registration.id,
            member,
            group: registration.group,
            organization,
            groupPrice: registration.groupPrice,
            recordAnswers: registration.recordAnswers,
            options: registration.options,
            trial: registration.trialUntil !== null,
            customStartDate: registration.startDate,
        });
    }

    clone() {
        return new RegisterItem({
            id: this.id,
            member: this.member,
            group: this.group,
            organization: this.organization,
            groupPrice: this.groupPrice.clone(),
            options: this.options.map(o => o.clone()),
            recordAnswers: new Map([...this.recordAnswers.entries()].map(([k, v]) => [k, v.clone()])),
            replaceRegistrations: this.replaceRegistrations.map(r => r.clone()),
            cartError: this.cartError,
            calculatedPrice: this.calculatedPrice,
            calculatedRefund: this.calculatedRefund,
            calculatedPriceDueLater: this.calculatedPriceDueLater,
            trial: this.trial,
            customStartDate: this.customStartDate,
        });
    }

    copyFrom(item: RegisterItem) {
        this.groupPrice = item.groupPrice.clone();
        this.options = item.options.map(o => o.clone());
        this.recordAnswers = new Map([...item.recordAnswers.entries()].map(([k, v]) => [k, v.clone()]));
        this.calculatedPrice = item.calculatedPrice;
        this.calculatedRefund = item.calculatedRefund;
        this.calculatedPriceDueLater = item.calculatedPriceDueLater;
        this.trial = item.trial;
        this.customStartDate = item.customStartDate;
    }

    static fromId(idRegisterItem: IDRegisterItem, context: RegisterContext) {
        const member = context.members.find(m => m.member.id === idRegisterItem.memberId);
        if (!member) {
            throw new Error('Member not found: ' + idRegisterItem.memberId);
        }

        const organization = context.organizations.find(o => o.id === idRegisterItem.organizationId);
        if (!organization) {
            throw new Error('Organization not found: ' + idRegisterItem.organizationId);
        }

        const group = context.groups.find(g => g.id === idRegisterItem.groupId);
        if (!group) {
            throw new Error('Group not found: ' + idRegisterItem.groupId);
        }

        const replaceRegistrations: Registration[] = [];

        for (const registrationId of idRegisterItem.replaceRegistrationIds) {
            const registration = member.patchedMember.registrations.find(r => r.id === registrationId);
            if (!registration) {
                throw new Error('Registration not found: ' + registrationId);
            }
            replaceRegistrations.push(registration);
        }

        return new RegisterItem({
            id: idRegisterItem.id,
            member,
            group,
            organization,
            groupPrice: idRegisterItem.groupPrice,
            options: idRegisterItem.options,
            recordAnswers: idRegisterItem.recordAnswers,
            replaceRegistrations,
            trial: idRegisterItem.trial,
            customStartDate: idRegisterItem.customStartDate,
        });
    }

    convert(): IDRegisterItem {
        return IDRegisterItem.create({
            id: this.id,
            memberId: this.member.member.id,
            groupId: this.group.id,
            organizationId: this.organization.id,
            groupPrice: this.groupPrice,
            options: this.options,
            replaceRegistrationIds: this.replaceRegistrations.map(r => r.id),
            recordAnswers: this.recordAnswers,
            trial: this.trial,
            customStartDate: this.customStartDate,
        });
    }

    get isInCart() {
        return this.member.family.checkout.cart.contains(this);
    }

    get showItemView() {
        return !!this.replaceRegistrations.length || this.group.settings.prices.length !== 1 || this.group.settings.optionMenus.length > 0 || this.group.type === GroupType.WaitingList || this.group.settings.description.length > 2 || this.group.settings.prices[0].price.price > 0 || (!this.isInCart && !this.isValid);
    }

    calculatePrice() {
        this.calculatedPrice = this.groupPrice.price.forMember(this.member);
        this.calculatedRefund = 0;

        for (const option of this.options) {
            this.calculatedPrice += option.option.price.forMember(this.member) * option.amount;
        }

        for (const registration of this.replaceRegistrations) {
            this.calculatedRefund += registration.price;
        }

        if (this.calculatedTrialUntil) {
            this.calculatedPriceDueLater = this.calculatedPrice;
            this.calculatedPrice = 0;
        }
        else {
            this.calculatedPriceDueLater = 0;
        }
    }

    get totalPrice() {
        return this.calculatedPrice - this.calculatedRefund;
    }

    get priceBreakown(): PriceBreakdown {
        let all: PriceBreakdown = [];

        for (const registration of this.replaceRegistrations) {
            all.push({
                name: this.checkout.isAdminFromSameOrganization ? 'Reeds aangerekend voor ' + registration.group.settings.name : 'Terugbetaling ' + registration.group.settings.name,
                price: -registration.price,
            });
        }

        if (this.calculatedPriceDueLater !== 0) {
            const trialUntil = this.calculatedTrialUntil;
            all.push({
                name: 'Later te betalen',
                price: this.calculatedPriceDueLater,
                description: trialUntil ? `Tegen ${Formatter.date(trialUntil)}` : undefined,
            });
        }

        all = all.filter(a => a.price !== 0);

        if (all.length > 0) {
            all.unshift({
                name: 'Subtotaal',
                price: this.calculatedPrice,
            });
        }
        return [
            ...all,
            {
                name: this.checkout.isAdminFromSameOrganization ? (this.totalPrice >= 0 ? 'Openstaand bedrag stijgt met' : 'Openstaand bedrag daalt met') : (this.calculatedPriceDueLater !== 0 ? 'Nu te betalen' : 'Totaal'),
                price: this.checkout.isAdminFromSameOrganization ? Math.abs(this.totalPrice) : this.totalPrice,
            },
        ];
    }

    getFilteredPrices() {
        const base = this.group.settings.getFilteredPrices({ admin: this.checkout.isAdminFromSameOrganization });

        if (this.groupPrice && !base.some(b => b.id === this.groupPrice.id)) {
            return [this.groupPrice, ...base];
        }
        return base;
    }

    getFilteredOptionMenus() {
        return this.group.settings.getFilteredOptionMenus({ admin: this.checkout.isAdminFromSameOrganization });
    }

    getFilteredOptions(menu: GroupOptionMenu) {
        return menu.getFilteredOptions({ admin: this.checkout.isAdminFromSameOrganization });
    }

    get memberId() {
        return this.member.id;
    }

    get groupId() {
        return this.group.id;
    }

    get reduced() {
        return this.member.patchedMember.details.requiresFinancialSupport?.value ?? false;
    }

    get family() {
        return this.member.family;
    }

    get checkout() {
        return this.family.checkout;
    }

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(group: Group, options?: { warnings?: boolean; forWaitingList?: boolean; final?: boolean }) {
        this.group = group;

        const errors = new SimpleErrors();

        if (this.group.settings.prices.length === 0) {
            errors.addError(
                new SimpleError({
                    code: 'product_unavailable',
                    message: 'Product unavailable',
                    human: 'Er is iets fout met de tariefinstellingen van ' + this.group.settings.name + ', waardoor je nu niet kan inschrijven. Neem contact op met een beheerder en vraag de tariefinstellingen na te kijken.',
                }),
            );
        }
        else {
            const groupPrice = this.group.settings.prices.find(p => p.id === this.groupPrice.id);
            if (!groupPrice) {
                errors.addError(
                    new SimpleError({
                        code: 'product_unavailable',
                        message: 'Product unavailable',
                        human: 'Eén of meerdere tarieven van ' + this.group.settings.name + ' zijn niet meer beschikbaar',
                        meta: { recoverable: true },
                    }),
                );
            }
            else {
                this.groupPrice = groupPrice;
            }
        }

        // Check all options
        const remainingMenus = this.group.settings.optionMenus.slice();

        for (const o of this.options) {
            let index = remainingMenus.findIndex(m => m.id === o.optionMenu.id);
            if (index == -1) {
                // Check if it has a multiple choice one
                index = this.group.settings.optionMenus.findIndex(m => m.id === o.optionMenu.id);
                errors.addError(new SimpleError({
                    code: 'option_menu_unavailable',
                    message: 'Option menu unavailable',
                    human: 'Eén of meerdere keuzemogelijkheden van ' + this.group.settings.name + ' zijn niet meer beschikbaar',
                    meta: { recoverable: true },
                }));
                continue;
            }

            const menu = remainingMenus[index];
            if (!menu.multipleChoice) {
                // Already used: not possible to add another
                remainingMenus.splice(index, 1);
            }

            const option = menu.options.find(m => m.id === o.option.id);

            if (!option) {
                errors.addError(new SimpleError({
                    code: 'option_unavailable',
                    message: 'Option unavailable',
                    human: 'Eén of meerdere keuzemogelijkheden van ' + this.group.settings.name + ' zijn niet meer beschikbaar',
                    meta: { recoverable: true },
                }));
                continue;
            }

            // Update to latest data
            o.optionMenu = menu;
            o.option = option;
        }

        if (remainingMenus.filter(m => !m.multipleChoice).length > 0) {
            errors.addError(
                new SimpleError({
                    code: 'missing_menu',
                    message: "Missing menu's " + remainingMenus.filter(m => !m.multipleChoice).map(m => m.name).join(', '),
                    human: 'Er zijn nieuwe keuzemogelijkheden voor ' + this.group.settings.name + ' waaruit je moet kiezen',
                    meta: { recoverable: true },
                }),
            );
        }

        if (options?.final) {
            // Check all answers are answered
            try {
                RecordCategory.validate(this.group.settings.recordCategories, this);
            }
            catch (e) {
                if (isSimpleErrors(e) || isSimpleError(e)) {
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty();
    }

    willReplace(registrationId: string) {
        return this.replaceRegistrations.some(rr => rr.id === registrationId);
    }

    isAlreadyRegistered() {
        return !!this.member.member.registrations.find(r => !this.willReplace(r.id) && r.groupId === this.group.id && r.registeredAt !== null && r.deactivatedAt === null);
    }

    hasReachedCategoryMaximum(): boolean {
        if (this.group.type !== GroupType.Membership) {
            return false;
        }

        const parents = this.group.getParentCategories(this.organization.period.settings.categories, false);

        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.member.patchedMember.registrations.filter((r) => {
                    if (!this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
                        return true;
                    }
                    return false;
                }).length;

                const waiting = this.checkout.cart.items.filter((item) => {
                    return item.member.member.id === this.member.member.id && parent.groupIds.includes(item.group.id) && item.group.id !== this.group.id;
                }).length;
                if (count + waiting >= parent.settings.maximumRegistrations) {
                    return true;
                }
            }
        }
        return false;
    }

    isInvited() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && r.registeredAt === null && r.canRegister);
    }

    doesMeetRequireGroupIds() {
        if (this.group.settings.requireGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && this.group.settings.requireGroupIds.includes(r.groupId);
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireGroupIds.includes(item.group.id))) {
                return false;
            }
        }

        if (this.group.settings.requireDefaultAgeGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return r.group.periodId === this.group.periodId && !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && r.group.defaultAgeGroupId && this.group.settings.requireDefaultAgeGroupIds.includes(r.group.defaultAgeGroupId);
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && item.group.defaultAgeGroupId && this.group.settings.requireDefaultAgeGroupIds.includes(item.group.defaultAgeGroupId))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequireOrganizationIds() {
        if (this.group.settings.requireOrganizationIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return r.group.periodId === this.group.periodId && !this.willReplace(r.id) && r.group.type === GroupType.Membership && this.group.settings.requireOrganizationIds.includes(r.organizationId) && r.registeredAt !== null && r.deactivatedAt === null;
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireOrganizationIds.includes(item.organization.id))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequireOrganizationTags() {
        if (this.group.settings.requireOrganizationTags.length > 0) {
            const hasOrganization = this.member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] }).find((organization) => {
                return organization.meta.matchTags(this.group.settings.requireOrganizationTags);
            });

            if (!hasOrganization && !this.checkout.cart.items.find(item => item.member.id === this.member.id && item.organization.meta.matchTags(this.group.settings.requireOrganizationTags))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequirePlatformMembershipOn() {
        if (this.group.settings.requirePlatformMembershipOn !== null) {
            const requirePlatformMembershipOn = this.group.settings.requirePlatformMembershipOn;
            return !!this.member.patchedMember.platformMemberships.find(m => m.isActive(requirePlatformMembershipOn));
        }
        return true;
    }

    isExistingMemberOrFamily() {
        return this.member.isExistingMember(this.group.organizationId) || (this.group.settings.priorityForFamily && !!this.family.members.find(f => f.isExistingMember(this.group.organizationId)));
    }

    get description() {
        const descriptions: string[] = [];

        if (this.replaceRegistrations.length > 0) {
            for (const registration of this.replaceRegistrations) {
                descriptions.push('Verplaatsen vanaf ' + registration.group.settings.name);
            }
        }

        if (this.getFilteredPrices().length > 1) {
            descriptions.push(this.groupPrice.name);
        }

        for (const option of this.options) {
            descriptions.push(option.optionMenu.name + ': ' + option.option.name + (option.option.allowAmount ? ` x ${option.amount}` : ''));
        }

        return descriptions.filter(d => !!d).join('\n');
    }

    hasReachedGroupMaximum() {
        const available = this.group.settings.getRemainingStock(this);

        if (available !== null && available <= 0) {
            return true;
        }

        // If all prices are sold out -> also reached maximum
        const prices = this.getFilteredPrices();
        if (prices.length > 0) {
            let allPricesSoldOut = true;
            for (const price of prices) {
                const remaining = price.getRemainingStock(this);
                if (remaining === null || remaining > 0) {
                    allPricesSoldOut = false;
                    break;
                }
            }

            if (allPricesSoldOut) {
                return true;
            }
        }

        // If non-multiple choice option menu's are sold out -> also reached maximum
        const optionMenus = this.getFilteredOptionMenus();
        for (const menu of optionMenus) {
            if (!menu.multipleChoice) {
                let allOptionsSoldOut = true;
                for (const option of menu.options) {
                    const remaining = option.getRemainingStock(this);
                    if (remaining === null || remaining > 0) {
                        allOptionsSoldOut = false;
                        break;
                    }
                }

                if (allOptionsSoldOut) {
                    return true;
                }
            }
        }

        return false;
    }

    get validationErrorForWaitingList() {
        try {
            this.validate({ forWaitingList: true });
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return e.getHuman();
            }
            throw e;
        }
        return null;
    }

    get validationError() {
        try {
            this.validate();
        }
        catch (e) {
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
            this.validate({ warnings: true });
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return e.getHuman();
            }
            throw e;
        }
        return null;
    }

    get isValid() {
        return this.validationError === null;
    }

    get defaultStartDate() {
        if (this.replaceRegistrations.length > 0) {
            const reg = this.replaceRegistrations[0];
            if (reg.startDate && reg.startDate.getTime() >= this.group.settings.startDate.getTime()) {
                return reg.startDate;
            }
            return this.group.settings.startDate;
        }
        let startDate = Formatter.luxon(new Date());
        startDate = startDate.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        return new Date(Math.max(startDate.toJSDate().getTime(), this.group.settings.startDate.getTime()));
    }

    get calculatedStartDate() {
        return this.customStartDate ?? this.defaultStartDate;
    }

    get calculatedTrialUntil() {
        if (!this.trial) {
            return null;
        }

        let trialUntil = Formatter.luxon(this.calculatedStartDate).plus({ days: this.group.settings.trialDays });
        trialUntil = trialUntil.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
        return trialUntil.toJSDate();
    }

    get canHaveTrial() {
        if (this.group.type !== GroupType.Membership) {
            return false;
        }

        if (this.group.settings.trialDays <= 0) {
            return false;
        }

        if (this.replaceRegistrations.find(r => r.trialUntil !== null)) {
            return true;
        }
        const currentPeriodId = this.organization.period.period.id;
        const previousPeriodId = this.organization.period.period.previousPeriodId;

        if (!previousPeriodId) {
            // We have no data: never give trails to avoid accidental trials
            return false;
        }

        if (this.group.periodId !== currentPeriodId) {
            return false;
        }

        if (this.group.defaultAgeGroupId) {
            // Use platform based logic to determine if it is a new member by looking at memberships
            const types = this.member.platform.config.membershipTypes.filter(m => m.behaviour === PlatformMembershipTypeBehaviour.Period).map(m => m.id);
            const hasBlockingMemberships = !!this.member.patchedMember.platformMemberships.find((m) => {
                if (!types.includes(m.membershipTypeId)) {
                    return false;
                }

                if (m.periodId === currentPeriodId && m.balanceItemId) {
                    // Already has a membership for the current period - which is not deletable
                    return true;
                }

                if (m.periodId !== previousPeriodId) {
                    // Not previous period
                    return false;
                }

                return true;
            });

            if (hasBlockingMemberships) {
                return false;
            }

            return true;
        }

        // Should not have a registration last period
        const reg = this.member.filterRegistrations({
            organizationId: this.group.organizationId,
            types: [GroupType.Membership],
            periodId: previousPeriodId,
        });
        return reg.length === 0;
    }

    validatePeriod(group: Group, type: 'move' | 'register', admin = false) {
        if (group.type === GroupType.WaitingList) {
            return;
        }

        const platform = this.family.platform;

        const periodId = group.periodId;
        if (periodId !== this.organization.period.period.id) {
            if (!admin) {
                throw new SimpleError({
                    code: 'different_period',
                    message: 'Different period',
                    human: type === 'register' ? `Je kan niet meer inschrijven voor ${group.settings.name} omdat dit werkjaar niet actief is.` : `Je kan geen inschrijvingen wijzigen van ${group.settings.name} omdat dat werkjaar niet actief is.`,
                });
            }
        }

        const period = periodId === platform.period.id ? platform.period : (periodId === this.organization.period.period.id ? this.organization.period.period : group.settings.period);

        if (!period) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Locked period',
                human: type === 'register' ? `Je kan niet meer inschrijven voor ${group.settings.name} omdat dit werkjaar is afgesloten.` : `Je kan geen inschrijvingen wijzigen van ${group.settings.name} omdat dit werkjaar is afgesloten.`,
            });
        }

        if (!period || period.locked) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Locked period',
                human: type === 'register' ? `Je kan niet meer inschrijven voor ${group.settings.name} omdat werkjaar ${period.nameShort} is afgesloten.` : `Je kan geen inschrijvingen wijzigen van ${group.settings.name} omdat werkjaar ${period.nameShort} is afgesloten.`,
            });
        }
    }

    validate(options?: { warnings?: boolean; forWaitingList?: boolean; final?: boolean }) {
        this.refresh(this.group, options);
        const checkout = this.member.family.checkout;
        const admin = checkout.isAdminFromSameOrganization && !options?.warnings;

        if (this.group.organizationId !== this.organization.id) {
            throw new Error('Group and organization do not match in RegisterItem.validate');
        }

        if (this.trial && !this.canHaveTrial) {
            this.trial = false;
        }

        if (!checkout.isAdminFromSameOrganization && this.customStartDate) {
            this.customStartDate = null;
        }

        if (this.customStartDate) {
            if (this.customStartDate < this.group.settings.startDate) {
                throw new SimpleError({
                    code: 'invalid_start_date',
                    message: 'Invalid start date',
                    human: 'De startdatum van de inschrijving moet na de startdatum van de groep zelf zijn',
                    field: 'customStartDate',
                });
            }

            if (this.customStartDate > this.group.settings.endDate) {
                throw new SimpleError({
                    code: 'invalid_start_date',
                    message: 'Invalid start date',
                    human: 'De startdatum van de inschrijving moet voor de einddatum van de groep zijn',
                    field: 'customStartDate',
                });
            }
        }

        if (this.checkout.singleOrganization && this.checkout.singleOrganization.id !== this.organization.id) {
            throw new SimpleError({
                code: 'multiple_organizations',
                message: 'Cannot add items of multiple organizations to the checkout',
                human: `Reken eerst jouw huidige winkelmandje af. Inschrijvingen voor ${this.group.settings.name} moeten aan een andere organisatie betaald worden en kan je daardoor niet samen afrekenen.`,
                meta: { recoverable: true },
            });
        }
        this.validatePeriod(this.group, 'register', admin);

        if (options?.forWaitingList && !this.group.waitingList) {
            throw new SimpleError({
                code: 'missing_waiting_list',
                message: 'No waiting list',
                human: `Je kan niet inschrijven voor de wachtlijst`,
            });
        }

        if (checkout.asOrganizationId && !checkout.isAdminFromSameOrganization && !this.group.settings.allowRegistrationsByOrganization) {
            throw new SimpleError({
                code: 'as_organization_disabled',
                message: 'allowRegistrationsByOrganization disabled',
                human: 'Inschrijvingen door organisaties zijn niet toegestaan voor ' + this.group.settings.name,
            });
        }

        for (const registration of this.replaceRegistrations) {
            // todo: check if you are allowed to move
            if (registration.memberId !== this.member.id) {
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Invalid member in replaceRegistration',
                    human: 'Je wilt een inschrijving verplaatsen van een ander lid in ruil voor een ander lid. Dit is niet toegestaan.',
                    field: 'replaceRegistrations',
                });
            }

            if (registration.group.organizationId !== this.organization.id) {
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Invalid organization in replaceRegistration',
                    human: 'Je wilt een inschrijving verplaatsen van een andere organisatie. Dit is niet toegestaan.',
                    field: 'replaceRegistrations',
                });
            }

            if (!checkout.isAdminFromSameOrganization) { // we don't use admins because this shouldn't raise a warning
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Not allowed to move registrations',
                    human: 'Enkel beheerders kunnen inschrijvingen verplaatsen.',
                    field: 'replaceRegistrations',
                });
            }

            this.validatePeriod(registration.group, 'move', admin);
        }

        // Already registered
        if (this.isAlreadyRegistered()) {
            throw new SimpleError({
                code: 'already_registered',
                message: 'Already registered',
                human: `${this.member.member.firstName} is al ingeschreven voor ${this.group.settings.name}`,
            });
        }

        if (this.hasReachedCategoryMaximum()) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            throw new SimpleError({
                code: 'maximum_reached',
                message: 'Maximum reached',
                human: `Je kan niet meer inschrijven voor ${this.group.settings.name} omdat ${this.member.patchedMember.name} al ingeschreven is voor een groep die je niet kan combineren.`,
            });
        }

        // Check if we have an invite (doesn't matter if registrations are closed)
        if (this.isInvited()) {
            return;
        }

        if (!admin) {
            if (!options?.forWaitingList) {
                if (this.group.notYetOpen) {
                    throw new SimpleError({
                        code: 'not_yet_open',
                        message: 'Not yet open',
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn nog niet geopend.`,
                    });
                }

                if (this.group.closed) {
                    throw new SimpleError({
                        code: 'closed',
                        message: 'Closed',
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn gesloten.`,
                    });
                }
            }

            // Check if it fits
            if (this.member.member.details) {
                if (!this.member.member.details.doesMatchGroup(this.group)) {
                    const error = this.member.member.details.getMatchingError(this.group);
                    throw new SimpleError({
                        code: 'not_matching',
                        message: 'Not matching: memberDetails',
                        human: error?.description ?? `${this.member.patchedMember.name} voldoet niet aan de voorwaarden om in te schrijven voor deze groep.`,
                    });
                }
            }

            // Check if registrations are limited
            if (!this.doesMeetRequireGroupIds()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireGroupIds',
                    human: `${this.member.patchedMember.name} voldoet niet aan de voorwaarden om in te schrijven voor deze groep (verplichte inschrijving bij leeftijdsgroep).`,
                });
            }

            if (!this.doesMeetRequireOrganizationIds()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireOrganizationIds',
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige actieve inschrijving  (verplichte inschrijving bij lokale groep).`,
                });
            }

            if (!this.doesMeetRequireOrganizationTags()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireOrganizationIds',
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige actieve inschrijving  (verplichte inschrijving in regio).`,
                });
            }

            if (!this.doesMeetRequirePlatformMembershipOn()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requirePlatformMembershipOn',
                    human: `${this.member.patchedMember.name} kan pas inschrijven met een geldige aansluiting (en dus verzekering) bij de koepel`,
                });
            }

            const existingMember = this.isExistingMemberOrFamily();

            // Pre registrations?
            if (this.group.activePreRegistrationDate) {
                if (!existingMember) {
                    throw new SimpleError({
                        code: 'pre_registrations',
                        message: 'Pre registrations',
                        human: 'Momenteel zijn de voorinschrijvingen nog bezig voor ' + this.group.settings.name + '. Dit is enkel voor bestaande leden' + (this.group.settings.priorityForFamily ? ' en hun broers/zussen' : '') + '.',
                    });
                }
            }

            const reachedMaximum = this.hasReachedGroupMaximum();

            if (!options?.forWaitingList) {
                // More detailed error messages
                if (this.group.settings.waitingListType === WaitingListType.All) {
                    throw new SimpleError({
                        code: 'waiting_list_required',
                        message: 'Waiting list required',
                        human: `Iedereen moet zich eerst op de wachtlijst inschrijven`,
                        meta: { recoverable: true },
                    });
                }

                if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
                    throw new SimpleError({
                        code: 'waiting_list_required',
                        message: 'Waiting list required',
                        human: `Nieuwe leden moeten zich eerst op de wachtlijst inschrijven`,
                        meta: { recoverable: true },
                    });
                }

                if (this.group.waitingList) {
                    if (reachedMaximum) {
                        throw new SimpleError({
                            code: 'waiting_list_required',
                            message: 'Waiting list required',
                            human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet. Je kan wel nog inschrijven voor de wachtlijst`,
                            meta: { recoverable: true },
                        });
                    }
                }
            }

            if (reachedMaximum && !this.group.waitingList) {
                // Reached maximum without waiting lists
                throw new SimpleError({
                    code: 'maximum_reached',
                    message: 'Maximum reached',
                    human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet`,
                    meta: { recoverable: true },
                });
            }

            // Only check individual stock if we haven't reached the maximum - otherwise it won't suggest to use the waiting list
            if (!reachedMaximum) {
                // Check individual stock
                if (this.groupPrice.getRemainingStock(this) === 0) {
                    throw new SimpleError({
                        code: 'stock_empty',
                        message: 'Stock empty',
                        human: `Het tarief ${this.groupPrice.name} is uitverkocht`,
                        meta: { recoverable: true },
                    });
                }

                for (const option of this.options) {
                    const remaining = option.option.getRemainingStock(this);
                    if (remaining !== null && remaining < option.amount) {
                        throw new SimpleError({
                            code: 'stock_empty',
                            message: 'Stock empty',
                            human: remaining === 0 ? `De keuzemogelijkheid ${option.option.name} is uitverkocht` : `Er zijn nog maar ${Formatter.pluralText(remaining, 'stuk', 'stuks')} beschikbaar van ${option.option.name}`,
                            meta: { recoverable: true },
                        });
                    }
                }
            }

            if (options?.forWaitingList) {
                // Also check waiting list itself
                const item = RegisterItem.defaultFor(this.member, this.group.waitingList!, this.organization);
                item.validate({ warnings: options?.warnings });
            }
        }
    }

    /**
     * Returns the stock that will be taken (or freed if negative) by all the register items before this item
     * and with the removed registrations freed up, so this can be negative
     */
    getCartPendingStockReservations() {
        const deleteRegistrations = [
            ...this.checkout.cart.deleteRegistrations.filter(r => r.groupId === this.group.id),
            ...this.replaceRegistrations.filter(r => r.groupId === this.group.id),
        ];

        const cartIndex = this.checkout.cart.items.findIndex(i => i.id === this.id);
        const itemsBefore = this.checkout.cart.items.slice(0, cartIndex === -1 ? undefined : cartIndex);

        return StockReservation.removed(
            itemsBefore.flatMap(i => i.getPendingStockReservations()), // these will be removed
            deleteRegistrations.flatMap(r => r.stockReservations), // these will be freed up
        );
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
                        amount: 1,
                    }),
                    ...this.options.map((o) => {
                        return StockReservation.create({
                            objectId: o.option.id,
                            objectType: 'GroupOption',
                            amount: o.amount,
                        });
                    }),
                ],
            }),
        ];

        const freed = this.replaceRegistrations.flatMap(r => r.stockReservations);
        return StockReservation.removed(base, freed);
    }

    doesMatchFilter(filter: StamhoofdFilter) {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, registerItemInMemoryFilterCompilers);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    isRecordEnabled(_: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.recordAnswers;
    }
}
