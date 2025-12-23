import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { PlatformFamilyManager, startSilentRegister } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemPaymentDetailed, DetailedReceivableBalance, Group, GroupPrice, GroupType, Organization, OrganizationRegistrationPeriod, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, Platform, PlatformFamily, PlatformMember, ReceivableBalanceType, RegisterCheckout, RegisterItem, Registration, RegistrationWithPlatformMember, TranslatedString } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';
import { MemberImportReport } from './MemberImportReport';

interface RegistrationData {
    group: Group;
    groupPrice: GroupPrice | null;
    customStartDate: Date | null;
    customEndDate: Date | null;
}

interface MemberImporterContext {
    readonly isWaitingList: boolean;
    readonly paid: boolean | null;
}

export class MemberImporter {
    private readonly platform: Platform;
    private readonly organization: Organization;
    private readonly period: OrganizationRegistrationPeriod;
    private readonly platformFamilyManager: PlatformFamilyManager;
    private readonly context: SessionContext;
    private readonly requestOwner: object;

    constructor({
        platform,
        organization,
        period,
        platformFamilyManager,
        context,
        requestOwner,
    }: {
        platform: Platform;
        organization: Organization;
        period: OrganizationRegistrationPeriod;
        platformFamilyManager: PlatformFamilyManager;
        context: SessionContext;
        requestOwner: object;
    }) {
        this.platform = platform;
        this.organization = organization;
        this.period = period;
        this.platformFamilyManager = platformFamilyManager;
        this.context = context;
        this.requestOwner = requestOwner;
    }

    async importResults(importMemberResults: ImportMemberResult[], importContext: MemberImporterContext, onProgress?: (progress: number) => void) {
        if (importMemberResults.find(m => !m.isExisting && (m.importRegistrationResult.group === null && m.importRegistrationResult.autoAssignedGroup === null))) {
            throw new SimpleError({
                code: 'no_group',
                message: $t(`dfbb830d-922c-42e7-a77a-f37e86e86998`),
            });
        }

        const reports: MemberImportReport[] = [];

        for (let i = 0; i < importMemberResults.length; i++) {
            const importResult = importMemberResults[i];
            const report = new MemberImportReport(importResult);

            try {
                await this.importMember(importResult, importMemberResults);
                await this.importRegistration(importResult, importContext);
                await this.importPayment(importResult, importContext);
                await sleep(100);
            }
            catch (e: any) {
                console.error(e);
                let base: string;

                if (importResult.isRegistrationImported) {
                    base = $t('e2057717-8967-4f81-a717-6bdf9caebc01');
                }
                else if (importResult.isMemberImported) {
                    base = $t('c51416d6-e3b2-4666-83ad-dcf8fc5f40e6');
                }
                else {
                    base = $t('bd42c95e-8f61-4c5a-a66b-b86b6b7130ba');
                }

                report.setErrorMessage(`${base} ${this.getErrorMessage(e)}`);
            }

            reports.push(report);

            if (onProgress) {
                const progress = ((i + 1) / importMemberResults.length);
                onProgress(progress);
            }
        }

        return reports;
    }

    hasNewRegistration(member: ImportMemberResult, isWaitingList: boolean) {
        const group = (member.importRegistrationResult.group ?? member.importRegistrationResult.autoAssignedGroup);

        if (!group) {
            return false;
        }

        // Check if we are already registered for this group
        if (member.existingMember) {
            const periodId = this.period.period.id;
            const existing = member.existingMember.filterRegistrations({ groups: [group], periodId });

            if (existing.length && isWaitingList) {
                return false;
            }

            if (existing.length && !isWaitingList && existing.find(e => !(e.group.type === GroupType.WaitingList))) {
            // already registered
                return false;
            }
        }

        return true;
    }

    buildRegistration(member: ImportMemberResult, isWaitingList: boolean): RegistrationData | null {
        if (!this.hasNewRegistration(member, isWaitingList)) {
            return null;
        }

        let group = (member.importRegistrationResult.group ?? member.importRegistrationResult.autoAssignedGroup);

        if (!group) {
            return null;
        }

        let groupPrice: GroupPrice | null = null;

        if (isWaitingList) {
            if (group.waitingList) {
                group = group.waitingList;
            }
        }
        else {
            const isReducedPrice = member.patchedDetails.shouldApplyReducedPrice;
            groupPrice = this.getGroupPrice(group, {
                priceValue: member.importRegistrationResult.price === null ? undefined : member.importRegistrationResult.price,
                priceName: member.importRegistrationResult.priceName === null ? undefined : member.importRegistrationResult.priceName,
                isReducedPrice,
            });
        }

        const registrationData: RegistrationData = {
            group,
            groupPrice,
            customStartDate: member.importRegistrationResult.startDate,
            customEndDate: member.importRegistrationResult.endDate,
        };

        return registrationData;
    }

    getOverrideRegistrations(registration: RegistrationData, member: ImportMemberResult): Registration[] {
        if (!member.existingMember) {
            return [];
        }

        const list: Registration[] = [];

        const group = registration.group;
        const periodId = this.period.period.id;

        const parents = group.getParentCategories(this.period.availableCategories, false);

        for (const parent of parents) {
            const groupsInParent = parent.groupIds.map(id => this.period.groups.find(g => g.id === id)).filter(g => !!g) as Group[];

            if (parent.settings.maximumRegistrations === 1) {
            // Delete all registrations for these groups
                const existing = member.existingMember.filterRegistrations({ groups: groupsInParent, periodId });
                for (const r of existing) {
                    if (list.find(l => l.id === r.id)) {
                        continue;
                    }
                    list.push(r);
                }
            }
        }
        return list;
    }

    private getErrorMessage(error: any) {
        if (error instanceof SimpleError) {
            if (error.code === 'invalid_field') {
                if (error.field) {
                    const recordCategories = [
                        ...(this.organization?.meta.recordsConfiguration.recordCategories ?? []),
                        ...this.platform.config.recordsConfiguration.recordCategories,
                        ...this.period.groups.flatMap(g => g.settings.recordCategories),
                    ];

                    for (const category of recordCategories) {
                        for (const record of category.getAllRecords()) {
                            if (error.field.includes(record.id)) {
                                return `${error.human ?? error.message} (${record.name.toString()})`;
                            }
                        }
                    }
                }
            }

            return error.human ?? error.message;
        }
        else if (error instanceof SimpleErrors) {
            const messages = error.errors.map(e => this.getErrorMessage(e));
            return messages.join(' ');
        }

        if (typeof error.message === 'string') {
            return error.message;
        }

        return $t('8a50ee7d-f37e-46cc-9ce7-30c7b37cefe8');
    }

    private async importMember(importResult: ImportMemberResult, importMemberResults: ImportMemberResult[]) {
        if (importResult.isMemberImported) {
            return;
        }

        const platformMember = importResult.getPatchedPlatformMember(this.platform);
        await this.platformFamilyManager.save([platformMember], true);
        importResult.setImportedPlatformMember(platformMember);

        // the backend will add users to the member -> the new members should be regrouped in families
        regroupNewMembersInFamilies(importMemberResults);
    }

    private async importRegistration(importResult: ImportMemberResult, importContext: MemberImporterContext) {
        if (importResult.isRegistrationImported) {
            return;
        }
        const checkout = this.createCheckout(importResult, importContext.isWaitingList);

        if (checkout.cart.isEmpty) {
            return;
        }

        await startSilentRegister({
            checkout,
            context: this.context,
            admin: true,
        });

        importResult.markRegistrationImported();
    }

    private async importPayment(importResult: ImportMemberResult, importContext: MemberImporterContext) {
        if (importResult.isPaymentImported) {
            return;
        }

        const payments: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();

        const checkedOutGroup = importResult.checkedOutGroup;
        if (!checkedOutGroup) {
            return;
        }

        const registeredPlatformMember = importResult.registeredPlatformMember;
        if (!registeredPlatformMember) {
            return;
        }

        const paidPrice = importResult.importRegistrationResult.paidPrice;

        if (paidPrice !== null && paidPrice > 0) {
            const balanceItems = await this.getBalanceItems(registeredPlatformMember, checkedOutGroup);
            const totalPricePaid = balanceItems.map(p => p.pricePaid).reduce((a, b) => a + b, 0);

            let priceLeft = paidPrice - totalPricePaid;

            const balanceItemPayments: BalanceItemPaymentDetailed[] = [];

            for (const balanceItem of balanceItems) {
                if (priceLeft <= 0) {
                    break;
                }

                const price = Math.min(priceLeft, balanceItem.priceOpen);

                if (price > 0) {
                    balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                        balanceItem,
                        price,
                    }));

                    priceLeft -= price;
                }
            }

            if (balanceItemPayments.length) {
                const payment = PaymentGeneral.create({
                    method: PaymentMethod.Unknown,
                    status: PaymentStatus.Succeeded,
                    type: PaymentType.Payment,
                    paidAt: new Date(),
                    customer: null,
                    balanceItemPayments,
                });

                payments.addPut(payment);
            }
        }
        else {
            let isPaid = false;

            if (importResult.importRegistrationResult.paid !== null) {
                isPaid = importResult.importRegistrationResult.paid;
            }
            else if (importContext.paid !== null) {
                isPaid = importContext.paid;
            }

            if (isPaid) {
                const balanceItems = await this.getBalanceItems(registeredPlatformMember, checkedOutGroup);
                if (balanceItems.length) {
                    const payment = PaymentGeneral.create({
                        method: PaymentMethod.Unknown,
                        status: PaymentStatus.Succeeded,
                        type: PaymentType.Payment,
                        paidAt: new Date(),
                        customer: null,
                        balanceItemPayments: balanceItems.map(balanceItem => BalanceItemPaymentDetailed.create({
                            balanceItem,
                            price: balanceItem.priceOpen,
                        })),
                    });

                    payments.addPut(payment);
                }
            }
        }

        if (payments.getPuts().length === 0) {
            return;
        }

        await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/payments',
            body: payments,
            decoder: new ArrayDecoder(PaymentGeneral),
            shouldRetry: false,
            owner: this.requestOwner,
        });

        importResult.markPaymentImported();
    }

    private createCheckout(importResult: ImportMemberResult, isWaitingList: boolean): RegisterCheckout {
        const checkout = new RegisterCheckout();
        checkout.asOrganizationId = this.organization.id;

        const member = importResult.getCheckoutMember();
        member.family.checkout = checkout;
        member.family.pendingRegisterItems = [];

        const organization = importResult.organization;

        const regsitrationData = this.buildRegistration(importResult, isWaitingList);

        if (regsitrationData) {
            const registrationsToRemove = this.getOverrideRegistrations(regsitrationData, importResult);
            const group = regsitrationData.group;
            importResult.setCheckedOutGroup(group);

            const item = new RegisterItem({
                member,
                group,
                organization,
                customStartDate: regsitrationData?.customStartDate,
                customEndDate: regsitrationData?.customEndDate,
                groupPrice: regsitrationData?.groupPrice ?? undefined,
                recordAnswers: importResult.importRegistrationResult.recordAnswers.size ? importResult.importRegistrationResult.recordAnswers : undefined,
            });

            for (const registration of registrationsToRemove) {
                checkout.removeRegistration(new RegistrationWithPlatformMember({ registration, member }), { calculate: false });
            }

            checkout.add(item, { calculate: false });
        }

        return checkout;
    }

    private getGroupPrice(group: Group, matchPrice?: { priceValue?: number; priceName?: string; isReducedPrice: boolean }): GroupPrice {
        const prices = group.settings.getFilteredPrices({ admin: true });
        const matchedOnName: GroupPrice[] = [];
        const matchedOnPrice: GroupPrice[] = [];

        for (const price of prices) {
            if (matchPrice !== undefined) {
                const { priceValue, priceName, isReducedPrice } = matchPrice;

                if (priceName !== undefined) {
                    if (price.name.toString() !== priceName) {
                        continue;
                    }
                    matchedOnName.push(price);
                }

                if (priceValue !== undefined) {
                    if (isReducedPrice) {
                        if (price.price.reducedPrice !== priceValue) {
                            continue;
                        }
                    }
                    else if (price.price.price !== priceValue) {
                        continue;
                    }

                    matchedOnPrice.push(price);
                }
            }

            // Noite: we don't need to check stock if we import as admin.
            // const stock = price.getRemainingStock(group);
            // if (stock !== 0) {
            return price;
            // }
        }

        // Probably all sold out
        // Select the first one anyway

        if (matchPrice?.priceName !== undefined && matchedOnName.length > 0) {
            return matchedOnName[0];
        }

        if (matchPrice?.priceValue !== undefined && matchedOnPrice.length > 0) {
            return matchedOnPrice[0];
        }

        return prices[0] ?? GroupPrice.create({ name: TranslatedString.create($t('83c99392-7efa-44d3-8531-1843c5fa7c4d')), id: '' });
    }

    private async getBalanceItems(platformMember: PlatformMember, group: Group): Promise<BalanceItem[]> {
        const registrations = platformMember.filterRegistrations({ groups: [group] });

        if (registrations.length === 1) {
            const registration = registrations[0];

            if (registration.groupPrice.price.price === 0) {
            // not necesary to get balance items if price is 0
                return [];
            }

            const response = await this.context.authenticatedServer.request({
                method: 'GET',
                path: `/receivable-balances/${ReceivableBalanceType.registration}/${registration.id}`,
                decoder: DetailedReceivableBalance as Decoder<DetailedReceivableBalance>,
                owner: this.requestOwner,
            });

            const receivableBalance = response.data;

            return receivableBalance.filteredBalanceItems;
        }

        throw new SimpleError({
            code: 'no_registration',
            message: $t(`97f24d1b-9730-45bb-9ebc-33d50bc3ddc1`, { name: platformMember.member.name }),
        });
    }
}

function getExistingFamilies(importMemberResults: ImportMemberResult[]) {
    const result = new Map<string, PlatformFamily>();

    for (const importResult of importMemberResults) {
        if (importResult.existingMember) {
            const existingFamily = importResult.existingMember.family;
            const uuid = existingFamily.uuid;

            if (result.has(uuid)) {
                continue;
            }
            else {
                result.set(uuid, existingFamily);
            }
        }
    }

    return [...result.values()];
}

function regroupNewMembersInFamilies(importMemberResults: ImportMemberResult[]) {
    const existingFamilies = getExistingFamilies(importMemberResults);

    for (const importResult of importMemberResults) {
        const newPlatformMember = importResult.newPlatformMember;

        if (newPlatformMember !== null) {
            const family = existingFamilies.find(f => f.belongsToFamily(newPlatformMember.member));

            if (family) {
                throw new Error('Not implemented');
                // family.add(newPlatformMember);
            }
            else {
                const family = newPlatformMember.family;
                if (!existingFamilies.includes(family)) {
                    existingFamilies.push(family);
                }
            }
        }
    }
}
