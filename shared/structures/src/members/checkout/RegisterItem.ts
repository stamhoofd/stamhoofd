import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, MapDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem } from '../../BalanceItem.js';
import { compileToInMemoryFilter } from '../../filters/InMemoryFilter.js';
import { registerItemInMemoryFilterCompilers } from '../../filters/inMemoryFilterDefinitions.js';
import { StamhoofdFilter } from '../../filters/StamhoofdFilter.js';
import { Group } from '../../Group.js';
import { GroupOption, GroupOptionMenu, GroupPrice, WaitingListType } from '../../GroupSettings.js';
import { GroupType } from '../../GroupType.js';
import { type Organization } from '../../Organization.js';
import { Platform, PlatformMembershipTypeBehaviour } from '../../Platform.js';
import { PriceBreakdown } from '../../PriceBreakdown.js';
import { StockReservation } from '../../StockReservation.js';
import { TranslatedString } from '../../TranslatedString.js';
import { ObjectWithRecords, PatchAnswers } from '../ObjectWithRecords.js';
import { type PlatformMember } from '../PlatformMember.js';
import { RecordAnswer, RecordAnswerDecoder } from '../records/RecordAnswer.js';
import { RecordCategory } from '../records/RecordCategory.js';
import { RecordSettings } from '../records/RecordSettings.js';
import { type Registration } from '../Registration.js';
import { type RegisterCart } from './RegisterCart.js';
import { type RegisterContext } from './RegisterCheckout.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

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

    @field({ decoder: DateDecoder, nullable: true, version: 391 })
    customEndDate: Date | null = null;

    hydrate(context: RegisterContext) {
        return RegisterItem.fromId(this, context);
    }
}

export class RegisterItem implements ObjectWithRecords {
    id: string;

    member: PlatformMember;
    group: Group;
    organization: Organization;
    trial = false;

    groupPrice: GroupPrice;
    options: RegisterItemOption[] = [];
    recordAnswers: Map<string, RecordAnswer> = new Map();
    customStartDate: Date | null = null;
    customEndDate: Date | null = null;

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
    replaceRegistrations: RegistrationWithPlatformMember[] = [];

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
        replaceRegistrations?: RegistrationWithPlatformMember[];
        cartError?: SimpleError | SimpleErrors | null;
        calculatedPrice?: number;
        calculatedRefund?: number;
        calculatedPriceDueLater?: number;
        trial?: boolean;
        customStartDate?: Date | null;
        customEndDate?: Date | null;
    }) {
        this.id = data.id ?? uuidv4();
        this.member = data.member;
        this.group = data.group;
        if (data.customStartDate !== undefined) {
            this.customStartDate = data.customStartDate;
        }
        if (data.customEndDate !== undefined) {
            this.customEndDate = data.customEndDate;
        }

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
                this.groupPrice = prices[0] ?? GroupPrice.create({ name: TranslatedString.create($t('83c99392-7efa-44d3-8531-1843c5fa7c4d')), id: '' });
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

                if (!added) {
                    if (options.length > 0) {
                        // Add the first (this one is sold out, but still required for correct error handling)
                        this.options.push(
                            RegisterItemOption.create({
                                option: options[0],
                                optionMenu: optionMenu,
                                amount: 1,
                            }),
                        );
                    }
                    else if (optionMenu.hidden) {
                        // Add the default option if the option menu is hidden
                        this.options.push(
                            RegisterItemOption.create({
                                option: optionMenu.getDefaultOption(),
                                optionMenu,
                                amount: 1,
                            }),
                        );
                    }
                }
            }
        }

        if (data.trial === undefined) {
            this.trial = this.canHaveTrial;
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
            customEndDate: registration.endDate,
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
            customEndDate: this.customEndDate,
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
        this.customEndDate = item.customEndDate;
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

        const replaceRegistrations: RegistrationWithPlatformMember[] = [];

        for (const registrationId of idRegisterItem.replaceRegistrationIds) {
            const registration = member.patchedMember.registrations.find(r => r.id === registrationId);
            if (!registration) {
                throw new Error('Registration not found: ' + registrationId);
            }
            replaceRegistrations.push(
                new RegistrationWithPlatformMember({
                    registration: registration,
                    member: member,
                }),
            );
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
            customEndDate: idRegisterItem.customEndDate,
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
            replaceRegistrationIds: this.replaceRegistrations.map(r => r.registration.id),
            recordAnswers: this.recordAnswers,
            trial: this.trial,
            customStartDate: this.customStartDate,
            customEndDate: this.customEndDate,
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

        for (const { registration } of this.replaceRegistrations) {
            this.calculatedRefund += registration.calculatedPrice;
        }

        // Small edge case for admins:
        // The registrations we are going to replace, can be in trial, and it is possible they have a balance already (shows as - X.XX in the cart total)
        // but if we add an item in trial, with a very short trail period, it will get added to the balance immediately (if we add it to calculatedPriceDueLater, it won't count the two together)
        // in order to calculate the difference between the added and removed balance, we are using getDueOffset
        if (this.calculatedTrialUntil && (this.replaceRegistrations.length === 0 || this.calculatedTrialUntil >= BalanceItem.getDueOffset())) {
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
        return this.getPriceBreakown(null);
    }

    getPriceBreakown(cart: RegisterCart | null): PriceBreakdown {
        let all: PriceBreakdown = [];

        for (const { registration } of this.replaceRegistrations) {
            all.push({
                name: this.checkout.isAdminFromSameOrganization ? $t('a87b9dfd-4acd-40c0-b430-f29dc8ec0fbf', { group: registration.group.settings.name }) : $t('Terugbetaling voor {group}', { group: registration.group.settings.name }),
                price: -registration.calculatedPrice,
            });
        }

        // Discounts
        let discountsTotal = 0;
        let discountsLater = 0;
        if (cart) {
            for (const discount of cart.bundleDiscounts) {
                const value = discount.getTotalFor(this);
                if (value !== 0) {
                    all.push({
                        name: discount.name,
                        price: -value,
                    });
                    if (this.calculatedTrialUntil) {
                        discountsLater += value;
                    }
                    else {
                        discountsTotal += value;
                    }
                }

                for (const registration of this.replaceRegistrations) {
                    const value = discount.getTotalFor(registration);
                    if (value !== 0) {
                        all.push({
                            name: discount.name,
                            price: -value,
                        });
                        discountsTotal += value;
                    }
                }
            }
        }

        if (this.calculatedPriceDueLater !== 0) {
            const trialUntil = this.calculatedTrialUntil;
            all.push({
                name: $t('45d9b6c1-1af8-4590-88ff-091a2a93c71a'),
                price: this.calculatedPriceDueLater - discountsLater,
                description: trialUntil ? $t('4789d323-f2da-4e87-a17c-7d29f813d68e', { date: Formatter.date(trialUntil) }) : undefined,
            });
        }

        all = all.filter(a => a.price !== 0);

        if (all.length > 0) {
            all.unshift({
                name: $t('bf12f6a6-3513-451e-bf8e-fdec5833f5da'),
                price: this.calculatedPrice + this.calculatedPriceDueLater,
            });
        }

        const correctedTotalPrice = this.totalPrice - discountsTotal;
        return [
            ...all,
            {
                name: this.checkout.isAdminFromSameOrganization ? (correctedTotalPrice >= 0 ? $t('566df267-1215-4b90-b893-0344c1f1f3d3') : $t('566e4010-63b7-42e7-9b94-fcdec3f95767')) : (this.calculatedPriceDueLater !== 0 ? $t('6219b760-90aa-4758-8102-119af7e596e7') : $t('482bf48b-ebbc-42e5-8718-6ee11d217510')),
                price: this.checkout.isAdminFromSameOrganization ? Math.abs(correctedTotalPrice) : correctedTotalPrice,
            },
        ];
    }

    getFilteredPrices() {
        const base = this.group.settings.getFilteredPrices({ admin: this.checkout.isAdminFromSameOrganization, date: this.calculatedStartDate });

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
                    human: $t(`57ac219a-4e8b-4606-bdb6-88566fdaeed0`, { group: this.group.settings.name }),
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
                        human: $t(`e7658433-afc4-4963-8ddf-afc1bda26bef`, {
                            group: this.group.settings.name,
                        }),
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
            if (index === -1) {
                // Check if it has a multiple choice one
                index = this.group.settings.optionMenus.findIndex(m => m.id === o.optionMenu.id);
                errors.addError(new SimpleError({
                    code: 'option_menu_unavailable',
                    message: 'Option menu unavailable',
                    human: $t(`e883ae60-e858-4bcf-9e60-5d03986459c2`, {
                        group: this.group.settings.name,
                    }),
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
                    human: $t(`e883ae60-e858-4bcf-9e60-5d03986459c2`, {
                        group: this.group.settings.name,
                    }),
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
                    human: $t(`6cf5b874-4092-47e2-b21c-3a531537a661`, { group: this.group.settings.name }),
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

            // Remove unsued answers
            this.recordAnswers = RecordCategory.removeOldAnswers(this.group.settings.recordCategories, this).getRecordAnswers();
        }

        errors.throwIfNotEmpty();
    }

    willReplace(registrationId: string) {
        return this.replaceRegistrations.some(rr => rr.registration.id === registrationId);
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

    getRequireGroupIdsError() {
        if (this.group.settings.requireGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && this.group.settings.requireGroupIds.includes(r.groupId);
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireGroupIds.includes(item.group.id))) {
                const requiredGroups = this.group.settings.requireGroupIds.map(id => this.organization.period.groups.find(g => g.id === id)).filter(g => !!g).map(g => g!.settings.name.toString());

                if (requiredGroups.length && requiredGroups.length === this.group.settings.requireGroupIds.length) {
                    return $t('1a537046-de7c-45ba-a990-da2fccd54325', {
                        firstName: this.member.patchedMember.details.firstName,
                        aOrB: Formatter.joinLast(requiredGroups, ', ', ' ' + $t('9a1ce222-c80d-4690-97be-0a896f2aa2ad') + ' '),
                        group: this.group.settings.name.toString(),
                    });
                }

                if (this.group.settings.requireGroupIds.length > 1) {
                    return $t('a5754a6a-a584-448f-ae31-30262c8ab868', {
                        firstName: this.member.patchedMember.details.firstName,
                        group: this.group.settings.name.toString(),
                    });
                }
                return $t('387311b4-eeed-48f5-950d-048ac0021666', {
                    firstName: this.member.patchedMember.details.firstName,
                    group: this.group.settings.name.toString(),
                });
            }
        }

        return null;
    }

    getRequireDefaultAgeGroupIdsError() {
        if (this.group.settings.requireDefaultAgeGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return r.registeredAt !== null && r.deactivatedAt === null && r.group.defaultAgeGroupId && this.isActivePeriodId(r.group.periodId) && !this.willReplace(r.id) && this.group.settings.requireDefaultAgeGroupIds.includes(r.group.defaultAgeGroupId);
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && item.group.defaultAgeGroupId && this.group.settings.requireDefaultAgeGroupIds.includes(item.group.defaultAgeGroupId))) {
                const defaultAgeGroups = this.group.settings.requireDefaultAgeGroupIds.map(id => Platform.shared.config.defaultAgeGroups.find(d => d.id === id)).filter(d => !!d).map(d => d!.name);
                return $t('1a537046-de7c-45ba-a990-da2fccd54325', {
                    firstName: this.member.patchedMember.details.firstName,
                    aOrB: defaultAgeGroups.length > 0 ? Formatter.joinLast(defaultAgeGroups, ', ', ' ' + $t('9a1ce222-c80d-4690-97be-0a896f2aa2ad') + ' ') : $t('ab204a0e-c114-4c5a-8f86-95aafe9464b0'),
                    group: this.group.settings.name.toString(),
                });
            }
        }
        return null;
    }

    doesMeetPreventGroupIds() {
        if (this.group.settings.preventGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return !this.willReplace(r.id) && r.registeredAt !== null && r.deactivatedAt === null && this.group.settings.preventGroupIds.includes(r.groupId);
            });

            if (hasGroup || this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.preventGroupIds.includes(item.group.id))) {
                return false;
            }
        }

        return true;
    }

    doesMeetRequireOrganizationIds() {
        if (this.group.settings.requireOrganizationIds.length > 0) {
            const hasGroup = this.member.member.registrations.find((r) => {
                return r.group.type === GroupType.Membership && r.registeredAt !== null && r.deactivatedAt === null && this.group.settings.requireOrganizationIds.includes(r.organizationId) && this.isActivePeriodId(r.group.periodId) && !this.willReplace(r.id);
            });

            if (!hasGroup && !this.checkout.cart.items.find(item => item.member.id === this.member.id && this.group.settings.requireOrganizationIds.includes(item.organization.id))) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequireOrganizationTags() {
        if (this.group.settings.requireOrganizationTags.length > 0) {
            const periodIds = [...this.group.getActivePeriodIds(this.organization)];
            const hasOrganization = this.member.filterOrganizations({ periodIds, types: [GroupType.Membership] }).find((organization) => {
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
            const now = new Date();
            return !!this.member.patchedMember.platformMemberships.find(m => m.isActive(requirePlatformMembershipOn)) || !!this.member.patchedMember.platformMemberships.find(m => m.isActive(now));
        }
        return true;
    }

    doesMeetRequirePlatformMembershipOnRegistrationDate() {
        if (this.group.settings.requirePlatformMembershipOnRegistrationDate === true) {
            const now = new Date();
            return !!this.member.patchedMember.platformMemberships.find(m => m.isActive(now));
        }
        return true;
    }

    isExistingMemberOrFamily() {
        return this.member.isExistingMember(this.organization) || (this.group.settings.priorityForFamily && !!this.family.members.find(f => f.isExistingMember(this.organization)));
    }

    get description() {
        const descriptions: string[] = [];

        if (this.replaceRegistrations.length > 0) {
            for (const { registration } of this.replaceRegistrations) {
                descriptions.push($t(`9b0ace12-de6c-43a8-aed2-e16a81a86d59`) + ' ' + registration.group.settings.name);
            }
        }

        if (this.getFilteredPrices().length > 1) {
            descriptions.push(this.groupPrice.name.toString());
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
            const { registration } = this.replaceRegistrations[0];
            if (registration.startDate && registration.startDate.getTime() >= this.group.settings.startDate.getTime()) {
                return registration.startDate;
            }
            return this.group.settings.startDate;
        }

        // If the group is 'active', we'll use the current date, otherwise we always take the start date of the group
        if (this.group.settings.endDate < new Date()) {
            // Group is not active anymore, so we use the start date
            return this.group.settings.startDate;
        }

        let startDate = Formatter.luxon(new Date());
        startDate = startDate.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        return new Date(Math.max(startDate.toJSDate().getTime(), this.group.settings.startDate.getTime()));
    }

    get defaultEndDate() {
        if (this.replaceRegistrations.length > 0) {
            const { registration } = this.replaceRegistrations[0];
            if (registration.endDate && registration.endDate.getTime() <= this.group.settings.endDate.getTime()) {
                return registration.endDate;
            }
        }

        return this.group.settings.endDate;
    }

    get calculatedStartDate() {
        return this.customStartDate ?? this.defaultStartDate;
    }

    get calculatedEndDate() {
        return this.customEndDate ?? this.defaultEndDate;
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

        if (this.replaceRegistrations.find(r => r.registration.trialUntil !== null)) {
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

    /**
     * Return wheter a given period id matches the period of this group for a requirement.
     * E.g. if you need to be registered for a default age group or organization, only count registrations that are in an active period.
     *
     * This evaluates to either the period of the group or the current period of the organization. The platform period is ignored and does not count as active.
     * This allows organizations to switch to a new period earlier and disable allowing registrations of the previous organization as being valid.
     */
    isActivePeriodId(periodId: string) {
        const activePeriodIds = this.group.getActivePeriodIds(this.organization);
        return activePeriodIds.has(periodId);
    }

    validatePeriod(group: Group, type: 'move' | 'register', admin = false) {
        if (group.type === GroupType.WaitingList) {
            return;
        }

        const platform = this.family.platform;

        const periodId = group.periodId;
        if (periodId !== this.organization.period.period.id) {
            if (group.type === GroupType.Membership) {
                if (!admin) {
                    throw new SimpleError({
                        code: 'different_period',
                        message: 'Different period',
                        human: type === 'register'
                            ? $t('dcb9126f-72c4-42c8-990a-8ddc747c0e2b', { group: group.settings.name })
                            : $t('7c55cb44-8149-414a-a162-ca9859014e81', { group: group.settings.name }),
                    });
                }
            }
        }

        const period = periodId === platform.period.id ? platform.period : (periodId === this.organization.period.period.id ? this.organization.period.period : group.settings.period);

        if (!period) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Locked period',
                human: type === 'register' ? $t('f6360ada-86e7-4ec8-86fb-fe9e750c4926', { group: group.settings.name }) : $t('Je kan geen inschrijvingen wijzigen van {group} omdat dit werkjaar is afgesloten.', { group: group.settings.name }),
            });
        }

        if (!period || period.locked) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Locked period',
                human: type === 'register' ? $t('26b8398d-a17c-4854-ae64-99a410ddeffb', { group: group.settings.name, period: period.nameShort }) : $t('Je kan geen inschrijvingen wijzigen van {group} omdat werkjaar {period} is afgesloten.', { group: group.settings.name, period: period.nameShort }),
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

        if (!checkout.isAdminFromSameOrganization) {
            if (this.customStartDate) {
                this.customStartDate = null;
            }

            if (this.customEndDate) {
                this.customEndDate = null;
            }
        }

        if (this.customEndDate) {
            if (this.customEndDate <= this.group.settings.startDate) {
                throw new SimpleError({
                    code: 'invalid_end_date',
                    message: 'Invalid end date',
                    human: $t(`ff3fd880-a223-46f6-aa02-bcd1ae8697cc`),
                    field: 'customEndDate',
                });
            }

            if (this.customEndDate > this.group.settings.endDate) {
                throw new SimpleError({
                    code: 'invalid_end_date',
                    message: 'Invalid end date',
                    human: $t(`38d52178-351c-433d-a767-2ca2b5efbfdc`),
                    field: 'customEndDate',
                });
            }

            if (this.customStartDate && this.customEndDate <= this.customStartDate) {
                throw new SimpleError({
                    code: 'invalid_end_date',
                    message: 'Invalid end date',
                    human: $t(`a9a35ed9-de40-40b7-81aa-c1a6c22c17b7`),
                    field: 'customEndDate',
                });
            }
        }

        if (this.customStartDate) {
            if (this.customStartDate < this.group.settings.startDate) {
                throw new SimpleError({
                    code: 'invalid_start_date',
                    message: 'Invalid start date',
                    human: $t(`3cfda9a5-3dbc-4490-9dcf-986aafc7b868`),
                    field: 'customStartDate',
                });
            }

            if (this.customStartDate > this.group.settings.endDate) {
                throw new SimpleError({
                    code: 'invalid_start_date',
                    message: 'Invalid start date',
                    human: $t(`683c669d-005d-4fc3-ae27-2c6e727fca2a`),
                    field: 'customStartDate',
                });
            }
        }

        if (this.checkout.singleOrganization && this.checkout.singleOrganization.id !== this.organization.id) {
            throw new SimpleError({
                code: 'multiple_organizations',
                message: 'Cannot add items of multiple organizations to the checkout',
                human: $t(`654675b0-0c6c-4953-9c49-d4536bc5b9f1`, { group: this.group.settings.name }),
                meta: { recoverable: true },
            });
        }
        this.validatePeriod(this.group, 'register', admin);

        if (options?.forWaitingList && !this.group.waitingList) {
            throw new SimpleError({
                code: 'missing_waiting_list',
                message: 'No waiting list',
                human: $t(`a33f3d4c-30bf-4ecb-9769-31d51f2bcc8f`),
            });
        }

        if (checkout.asOrganizationId && !checkout.isAdminFromSameOrganization && !this.group.settings.allowRegistrationsByOrganization) {
            throw new SimpleError({
                code: 'as_organization_disabled',
                message: 'allowRegistrationsByOrganization disabled',
                human: $t(`b41926c9-7846-4032-814c-2bf739ca6314`) + ' ' + this.group.settings.name,
            });
        }

        for (const { registration } of this.replaceRegistrations) {
            // todo: check if you are allowed to move
            if (registration.memberId !== this.member.id) {
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Invalid member in replaceRegistration',
                    human: $t(`309bdb9d-4028-4bec-9e68-13814866ee94`),
                    field: 'replaceRegistrations',
                });
            }

            if (registration.group.organizationId !== this.organization.id) {
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Invalid organization in replaceRegistration',
                    human: $t(`2f3db975-8bd4-41b2-980d-ab3ca678e111`),
                    field: 'replaceRegistrations',
                });
            }

            if (!checkout.isAdminFromSameOrganization) { // we don't use admins because this shouldn't raise a warning
                throw new SimpleError({
                    code: 'invalid_move',
                    message: 'Not allowed to move registrations',
                    human: $t(`e3a72c38-8d17-402e-8da8-bb4cab1b1b70`),
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
                human: $t(`40b728b0-6784-47bb-9ffe-53e7c88e638b`, {
                    member: this.member.member.firstName,
                    group: this.group.settings.name,
                }),
            });
        }

        if (this.hasReachedCategoryMaximum()) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            throw new SimpleError({
                code: 'maximum_reached',
                message: 'Maximum reached',
                human: $t(`73430be0-1a07-4730-9e2e-72528992767d`, {
                    group: this.group.settings.name,
                    member: this.member.patchedMember.name,
                }),
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
                        human: $t(`12d2ff48-8cb0-42a7-ad43-f5e6ef705320`, { group: this.group.settings.name }),
                    });
                }

                if (this.group.closed) {
                    throw new SimpleError({
                        code: 'closed',
                        message: 'Closed',
                        human: $t(`b527f658-6cb6-488c-9447-61533d63db74`, { group: this.group.settings.name }),
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
                        human: error?.description ?? $t(`e24f82f9-a11d-45bc-9719-3ebdfd1f28d6`, {
                            member: this.member.patchedMember.name,
                        }),
                    });
                }
            }

            // Check if registrations are limited
            const requireGroupIdsError = this.getRequireGroupIdsError();
            if (requireGroupIdsError) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireGroupIds',
                    human: requireGroupIdsError,
                });
            }

            const defaultAgeGroupError = this.getRequireDefaultAgeGroupIdsError();
            if (defaultAgeGroupError) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireDefaultAgeGroupIds',
                    human: defaultAgeGroupError,
                });
            }

            if (!this.doesMeetPreventGroupIds()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: preventGroupIds',
                    human: $t('a7f3e9ef-7d56-4648-91c8-280d6170617c', {
                        member: this.member.patchedMember.name,
                    }),
                });
            }

            if (!this.doesMeetRequireOrganizationIds()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireOrganizationIds',
                    human: $t(`78a012a9-3caa-405f-851d-429610138852`, { member: this.member.patchedMember.name }),
                });
            }

            if (!this.doesMeetRequireOrganizationTags()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requireOrganizationIds',
                    human: $t(`4ea84d3f-63f5-4ab0-bab2-a5c72fa0111d`, {
                        member: this.member.patchedMember.name,
                    }),
                });
            }

            if (!this.doesMeetRequirePlatformMembershipOn()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requirePlatformMembershipOn',
                    human: $t(`f7b1a08a-1431-45e3-83c3-8aa8bb1b18e6`, { member: this.member.patchedMember.name }),
                });
            }

            if (!this.doesMeetRequirePlatformMembershipOnRegistrationDate()) {
                throw new SimpleError({
                    code: 'not_matching',
                    message: 'Not matching: requirePlatformMembershipOnRegistrationDate',
                    human: $t(`33845ee8-009e-4ad2-a3d7-183e79033c4c`, { member: this.member.patchedMember.name }),
                });
            }

            const existingMember = this.isExistingMemberOrFamily();

            // Pre registrations?
            if (this.group.activePreRegistrationDate) {
                if (!existingMember) {
                    throw new SimpleError({
                        code: 'pre_registrations',
                        message: 'Pre registrations',
                        human: $t(`b2486175-6dbd-4aa4-a57c-dc7e322fcd31`, {
                            group: this.group.settings.name,
                        }) + (this.group.settings.priorityForFamily ? ' ' + $t(`4837a21c-e894-45fb-873f-1b09cbebc495`) : '') + '.',
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
                        human: $t(`b9229c91-e7cf-48d7-823f-982dc27fe638`),
                        meta: { recoverable: true },
                    });
                }

                if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
                    throw new SimpleError({
                        code: 'waiting_list_required',
                        message: 'Waiting list required',
                        human: $t(`466118b2-637f-4c46-b240-57bc9c3ee590`),
                        meta: { recoverable: true },
                    });
                }

                if (this.group.waitingList) {
                    if (reachedMaximum) {
                        throw new SimpleError({
                            code: 'waiting_list_required',
                            message: 'Waiting list required',
                            human: $t(`83f622e4-0ef5-4965-8d6d-10860df30a87`, {
                                group: this.group.settings.name,
                            }),
                            meta: { recoverable: true },
                        });
                    }
                }
            }

            if (!this.groupPrice.isInPeriod(this.calculatedStartDate)) {
                throw new SimpleError({
                    code: 'invalid_price',
                    message: 'GroupPrice is not valid for this date',
                    human: $t(`bc608e45-810c-4dd3-82f7-3eb2befc4ffc`),
                    meta: { recoverable: true },
                });
            }

            if (reachedMaximum && !this.group.waitingList) {
                // Reached maximum without waiting lists
                throw new SimpleError({
                    code: 'maximum_reached',
                    message: 'Maximum reached',
                    human: $t(`1b7b7815-6454-4570-8ce8-fcff09df2efd`, { group: this.group.settings.name }),
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
                        human: $t(`545a9cc4-553d-4013-a8ef-e4a9a3107a9c`, { name: this.groupPrice.name }),
                        meta: { recoverable: true },
                    });
                }

                for (const option of this.options) {
                    const remaining = option.option.getRemainingStock(this);
                    if (remaining !== null && remaining < option.amount) {
                        throw new SimpleError({
                            code: 'stock_empty',
                            message: 'Stock empty',
                            human: remaining === 0
                                ? $t(`96b60f72-2bc6-479d-b317-616e23056e5c`, { name: option.option.name })
                                : remaining > 1 ? $t('81dced9c-c5aa-4c49-b030-31363d3847db', { count: remaining.toString(), name: option.option.name }) : $t('Er is nog maar 1 stuk beschikbaar van {name}', { name: option.option.name }),
                            meta: { recoverable: true },
                        });
                    }

                    const maximumSelection = option.option.getMaximumSelection(this);
                    if (maximumSelection !== null && maximumSelection < option.amount) {
                        throw new SimpleError({
                            code: 'option_max',
                            message: 'Option maximum exceeded',
                            human: $t(`c006386b-0590-40c9-ae62-c4b7ade939f0`, {
                                name: option.option.name,
                            }),
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
            ...this.checkout.cart.deleteRegistrations.filter(r => r.registration.groupId === this.group.id),
            ...this.replaceRegistrations.filter(r => r.registration.groupId === this.group.id),
        ];

        const cartIndex = this.checkout.cart.items.findIndex(i => i.id === this.id);
        const itemsBefore = this.checkout.cart.items.slice(0, cartIndex === -1 ? undefined : cartIndex);

        return StockReservation.removed(
            itemsBefore.flatMap(i => i.getPendingStockReservations()), // these will be removed
            deleteRegistrations.flatMap(r => r.registration.stockReservations), // these will be freed up
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

        const freed = this.replaceRegistrations.flatMap(r => r.registration.stockReservations);
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

    patchRecordAnswers(patch: PatchAnswers): this {
        const cloned = this.clone();
        cloned.recordAnswers = patchObject(cloned.recordAnswers, patch);
        return cloned as this;
    }

    isSameRegistration(item: RegisterItem) {
        return item.memberId === this.memberId && item.groupId === this.groupId && item.organization.id === this.organization.id;
    }
}
