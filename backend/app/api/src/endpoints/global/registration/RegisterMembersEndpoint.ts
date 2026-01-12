import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, BalanceItemPayment, CachedBalance, Group, Member, MemberWithRegistrations, MolliePayment, MollieToken, Organization, PayconiqPayment, Payment, Platform, RateLimiter, Registration, User } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItem as BalanceItemStruct, BalanceItemType, IDRegisterCheckout, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, Payment as PaymentStruct, PaymentType, PermissionLevel, PlatformFamily, PlatformMember, ReceivableBalanceType, RegisterItem, RegisterResponse, TranslatedString, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { BuckarooHelper } from '../../../helpers/BuckarooHelper.js';
import { Context } from '../../../helpers/Context.js';
import { ServiceFeeHelper } from '../../../helpers/ServiceFeeHelper.js';
import { StripeHelper } from '../../../helpers/StripeHelper.js';
import { BalanceItemService } from '../../../services/BalanceItemService.js';
import { PaymentService } from '../../../services/PaymentService.js';
import { RegistrationService } from '../../../services/RegistrationService.js';
type Params = Record<string, never>;
type Query = undefined;
type Body = IDRegisterCheckout;
type ResponseBody = RegisterResponse;

export const demoLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 per hour
            limit: 10,
            duration: 60 * 1000 * 60,
        },
        {
            // Max 20 a day
            limit: 20,
            duration: 24 * 60 * 1000 * 60,
        },
    ],
});

export type RegistrationWithMemberAndGroup = Registration & { member: Member } & { group: Group };

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class RegisterMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = IDRegisterCheckout as Decoder<IDRegisterCheckout>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/register', {});

        if (params) {
            if (request.getVersion() < 257) {
                throw new SimpleError({
                    code: 'not_supported',
                    message: 'This version is no longer supported',
                    human: $t(`47f56c92-fcfb-4ef4-8d0b-fb0c959fb624`),
                });
            }
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        // Who is going to pay?
        let whoWillPayNow: 'member' | 'organization' | 'nobody' = 'member'; // if this is set to 'organization', there will also be created separate balance items so the member can pay back the paying organization

        if (request.body.asOrganizationId && request.body.asOrganizationId === organization.id) {
            // Fast fail
            if (!await Context.auth.hasSomeAccess(request.body.asOrganizationId)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to register members manually',
                    human: $t(`62fe6e39-f6b0-4836-b0f7-dc84d22a81e3`),
                    statusCode: 403,
                });
            }

            // We won't create a payment. The balance will get added to the outstanding amount of the member / already paying organization
            whoWillPayNow = 'nobody';
        }
        else if (request.body.asOrganizationId && request.body.asOrganizationId !== organization.id) {
            // Paying balance to a different organization requires finance permissions
            // we'll check later if you are also registering members, which requires full permissions
            if (!await Context.auth.canManageFinances(request.body.asOrganizationId)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to checkout as this organization for a different organization',
                    human: $t(`eff21f4c-2d50-4553-9eb9-8a9e399f4124`),
                    statusCode: 403,
                });
            }

            // The organization will pay to the organizing organization, and it will get added to the outstanding amount of the member towards the paying organization
            whoWillPayNow = 'organization';
        }

        // For non paid organizations, limit amount of tests
        if (!organization.meta.packages.isPaid) {
            const limiter = demoLimiter;

            try {
                limiter.track(organization.id, 1);
            }
            catch (e) {
                Email.sendWebmaster({
                    subject: '[Limiet] Limiet bereikt voor aantal inschrijvingen',
                    text: 'Beste, \nDe limiet werd bereikt voor het aantal inschrijvingen per dag. \nVereniging: ' + organization.id + ' (' + organization.name + ')' + '\n\n' + e.message + '\n\nStamhoofd',
                });

                throw new SimpleError({
                    code: 'too_many_emails_period',
                    message: 'Too many e-mails limited',
                    human: $t(`28fb7a27-9b8e-44e0-833b-44c72ab61306`),
                    field: 'recipients',
                });
            }
        }

        // Update balances before we start
        await BalanceItemService.flushCaches(organization.id);

        const deleteRegistrationIds = request.body.cart.deleteRegistrationIds;
        const deleteRegistrationModels = (deleteRegistrationIds.length ? (await Registration.getByIDs(...deleteRegistrationIds)) : []).filter(r => r.organizationId === organization.id);

        // Validate balance items (can only happen serverside)
        const balanceItemIds = request.body.cart.balanceItems.map(i => i.item.id);
        let memberBalanceItemsStructs: BalanceItemStruct[] = [];
        let balanceItemsModels: BalanceItem[] = [];
        if (balanceItemIds.length > 0) {
            balanceItemsModels = await BalanceItem.where({ id: { sign: 'IN', value: balanceItemIds }, organizationId: organization.id });
            if (balanceItemsModels.length !== balanceItemIds.length) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`3e10f812-8871-458c-ae03-c508abfd3ca5`),
                });
            }
            memberBalanceItemsStructs = balanceItemsModels.map(i => i.getStructure());
        }

        let members: MemberWithRegistrations[] = [];
        if (request.body.asOrganizationId) {
            const memberIds = Formatter.uniqueArray(
                [...request.body.memberIds, ...deleteRegistrationModels.map(i => i.memberId), ...balanceItemsModels.map(i => i.memberId).filter(m => m !== null)],
            );
            members = await Member.getBlobByIds(...memberIds);
        }
        else {
            // Load the user family (required to correctly calculate discounts across family members)
            members = await Member.getMembersWithRegistrationForUser(user);
        }
        const groupIds = request.body.groupIds;
        const groups = await Group.getByIDs(...groupIds);

        for (const group of groups) {
            if (group.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`57d57c76-4e76-4b0e-93b5-57ef8025f5ec`),
                });
            }
        }

        for (const member of members) {
            if (!await Context.auth.canAccessMember(
                member,
                request.body.asOrganizationId ? PermissionLevel.Read : PermissionLevel.Write,
            )) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to register this member',
                    human: $t(`7b7c4b2b-f30c-4cad-ba13-caad591bafde`),
                    statusCode: 403,
                });
            }
        }

        const platformMembers: PlatformMember[] = [];

        if (request.body.asOrganizationId) {
            const memberIds = Formatter.uniqueArray(
                [...request.body.memberIds, ...deleteRegistrationModels.map(i => i.memberId), ...balanceItemsModels.map(i => i.memberId).filter(m => m !== null)],
            );

            // todo: optimize performance of this
            // Load family for each member
            // this is required for family based discounts
            const platformStruct = await Platform.getSharedStruct();
            const contextOrganization = await AuthenticatedStructures.organization(organization);
            for (const memberId of memberIds) {
                const familyMembers = (await Member.getFamilyWithRegistrations(memberId));
                members.push(...familyMembers);
                const blob = await AuthenticatedStructures.membersBlob(familyMembers, true, undefined, { forAdminCartCalculation: true });
                const family = PlatformFamily.create(blob, {
                    platform: platformStruct,
                    contextOrganization,
                });
                const platformMember = family.members.find(m => m.id === memberId);
                if (!platformMember) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: 'Something went wrong while configuring the data',
                    });
                }
                platformMembers.push(platformMember);
            }

            if (memberIds.length > 0 && request.body.asOrganizationId && request.body.asOrganizationId !== organization.id) {
                // For registering members at a different organization, you need full permissions
                if (!await Context.auth.hasFullAccess(request.body.asOrganizationId)) {
                    throw new SimpleError({
                        code: 'forbidden',
                        message: 'No permission to register as this organization for a different organization',
                        human: $t(`62fe6e39-f6b0-4836-b0f7-dc84d22a81e3`),
                        statusCode: 403,
                    });
                }
            }
        }
        else {
            const blob = await AuthenticatedStructures.membersBlob(members, true);
            const family = PlatformFamily.create(blob, {
                platform: await Platform.getSharedStruct(),
                contextOrganization: await AuthenticatedStructures.organization(organization),
            });
            platformMembers.push(...family.members);
        }

        const organizationStruct = await AuthenticatedStructures.organization(organization);
        const checkout = request.body.hydrate({
            members: platformMembers,
            groups: await AuthenticatedStructures.groups(groups),
            organizations: [organizationStruct],
        });

        // Set circular references
        for (const member of platformMembers) {
            member.family.checkout = checkout;
        }

        checkout.setDefaultOrganization(organizationStruct);

        const registrations: RegistrationWithMemberAndGroup[] = [];
        const payRegistrations: { registration: RegistrationWithMemberAndGroup; item: RegisterItem }[] = [];
        const deactivatedRegistrationGroupIds: string[] = [];

        if (checkout.cart.isEmpty) {
            throw new SimpleError({
                code: 'empty_data',
                message: $t(`29d8bd5c-da83-49b9-a822-c44db58edd1a`),
            });
        }

        // Validate the cart
        checkout.validate({ memberBalanceItems: memberBalanceItemsStructs });

        const totalPrice = checkout.totalPrice;

        if (totalPrice !== request.body.totalPrice) {
            if (whoWillPayNow === 'nobody') {
                // Safe and important to ignore: we are only updating the outstanding amounts
                // If we would throw here, that could leak personal data (e.g. that the user uses financial support)
            }
            else {
                // when whoWillPay = organization/member, we should throw or the payment amount could be different / incorrect.
                // This never leaks information because in this case the user already has full access to the organization (asOrganizationId) or the member
                throw new SimpleError({
                    code: 'changed_price',
                    message: $t(`e424d549-2bb8-4103-9a14-ac4063d7d454`, { total: Formatter.price(totalPrice) }),
                });
            }
        }

        if (totalPrice % 100 !== 0) {
            throw new SimpleError({
                code: 'more_than_2_decimal_places',
                message: 'Unexpected total price. The total price should be rounded to maximum 2 decimal places',
            });
        }

        const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
        registrationMemberRelation.foreignKey = 'memberId';

        for (const item of checkout.cart.items) {
            const member = members.find(m => m.id == item.memberId);
            if (!member) {
                throw new SimpleError({
                    code: 'invalid_member',
                    message: $t(`bded79ec-0c69-47b1-9944-b9f3821b566e`),
                });
            }

            const group = groups.find(g => g.id == item.groupId);
            if (!group) {
                throw new SimpleError({
                    code: 'invalid_member',
                    message: $t(`c4896202-dd3b-4445-a530-3fed231259c2`),
                });
            }

            if (request.body.asOrganizationId) {
                // Do you have write access to this group?
                if (!await Context.auth.canRegisterMembersInGroup(group, request.body.asOrganizationId)) {
                    throw new SimpleError({
                        code: 'forbidden',
                        message: 'No permission to register in this group',
                        human: $t('36e8f895-91df-4c88-88e7-d4f0e9d1b5bf', { group: group.settings.name.toString() }),
                        statusCode: 403,
                    });
                }
            }

            // Check if this member is already registered in this group?
            const existingRegistrations = await Registration.where({ memberId: member.id, groupId: item.groupId, cycle: group.cycle, periodId: group.periodId, registeredAt: { sign: '!=', value: null } });

            for (const existingRegistration of existingRegistrations) {
                if (item.replaceRegistrations.some(r => r.registration.id === existingRegistration.id)) {
                    // Safe
                    continue;
                }

                if (checkout.cart.deleteRegistrations.some(r => r.registration.id === existingRegistration.id)) {
                    // Safe
                    continue;
                }

                if (existingRegistration.registeredAt !== null && existingRegistration.deactivatedAt === null) {
                    throw new SimpleError({
                        code: 'already_registered',
                        message: $t(`04d77a26-25c2-4a3e-a268-98bea9df45a2`, { member: member.firstName, group: group.settings.name }),
                    });
                }
            }

            let reuseRegistration: Registration | null = null;

            // For now don't reuse replace registrations - it has too many side effects and not a lot of added value
            if (item.replaceRegistrations.length === 1 && item.replaceRegistrations[0].group.id === item.group.id) {
                // Try to reuse this specific one
                reuseRegistration = (await Registration.getByID(item.replaceRegistrations[0].registration.id)) ?? null;
            }

            let startDate = item.calculatedStartDate;

            if (!reuseRegistration) {
                // Otherwise try to reuse a registration in the same period, for the same group that has been deactived for less than 7 days since the start of the new registration
                const possibleReuseRegistrations = existingRegistrations.filter(r =>
                    r.deactivatedAt !== null
                    && r.deactivatedAt.getTime() > startDate.getTime() - 7 * 24 * 60 * 60 * 1000,
                );

                // Never reuse a registration that has a balance - that means they had a cancellation fee and not all balance items were canceled (we don't want to merge in that state)
                const balances = await CachedBalance.getForObjects(possibleReuseRegistrations.map(r => r.id), null, ReceivableBalanceType.registration);

                reuseRegistration = possibleReuseRegistrations.find((r) => {
                    const balance = balances.filter(b => b.objectId === r.id).reduce((a, b) => a + b.amountOpen + b.amountPaid + b.amountPending, 0);
                    return balance === 0;
                }) ?? null;

                if (!item.customStartDate && reuseRegistration && reuseRegistration.startDate && reuseRegistration.startDate < startDate && reuseRegistration.startDate >= group.settings.startDate && !item.trial) {
                    startDate = reuseRegistration.startDate;
                }
            }

            const registration = (reuseRegistration ?? new Registration())
                .setRelation(registrationMemberRelation, member as Member)
                .setRelation(Registration.group, group);
            registration.organizationId = organization.id;
            registration.periodId = group.periodId;

            registration.memberId = member.id;
            registration.groupId = group.id;
            registration.price = 0; // will get filled by balance items themselves
            registration.groupPrice = item.groupPrice;
            registration.options = item.options;
            registration.recordAnswers = item.recordAnswers;
            registration.startDate = startDate;
            registration.endDate = item.calculatedEndDate;

            // Clear if we are reusing an existing registration
            registration.trialUntil = null;
            registration.pricePaid = 0;
            registration.payingOrganizationId = null;

            if (checkout.isAdminFromSameOrganization) {
                registration.sendConfirmationEmail = checkout.sendConfirmationEmail;
            }
            else {
                registration.sendConfirmationEmail = true;
                if (checkout.asOrganizationId) {
                    // use group default
                    registration.sendConfirmationEmail = group.privateSettings.sendConfirmationEmailForManualRegistrations;
                }
            }

            // NOTE: we don't reset deactivatedAt - registeredAt, because those will get reset when markValid is called later on (while keeping the original registeredAt date)
            // registration.deactivatedAt = null;
            // registration.registeredAt = null; // this is required to trigger platform membership updates

            if (item.trial) {
                registration.trialUntil = item.calculatedTrialUntil;
            }

            if (whoWillPayNow === 'organization' && request.body.asOrganizationId) {
                registration.payingOrganizationId = request.body.asOrganizationId;
            }

            if (whoWillPayNow === 'nobody' && item.replaceRegistrations.length > 0) {
                // If the replace registration was paid by an organization
                // Make sure this updated registration will also be paid by the organization, not the member
                const paidAsOrganization = item.replaceRegistrations[0].registration.payingOrganizationId;
                if (paidAsOrganization) {
                    registration.payingOrganizationId = paidAsOrganization;
                }
            }

            payRegistrations.push({
                registration,
                item,
            });

            registrations.push(registration);
        }

        // Validate payment method
        if (totalPrice > 0 && whoWillPayNow !== 'nobody') {
            const allowedPaymentMethods = organization.meta.registrationPaymentConfiguration.getAvailablePaymentMethods({
                amount: totalPrice,
                customer: checkout.customer,
            });

            if (!checkout.paymentMethod || !allowedPaymentMethods.includes(checkout.paymentMethod)) {
                throw new SimpleError({
                    code: 'invalid_payment_method',
                    message: $t(`2b1ca6a0-662e-4326-ada1-10239b6ddc6f`),
                });
            }

            if ((checkout.paymentMethod !== PaymentMethod.Transfer && checkout.paymentMethod !== PaymentMethod.PointOfSale) && (!request.body.redirectUrl || !request.body.cancelUrl)) {
                throw new SimpleError({
                    code: 'missing_fields',
                    message: 'redirectUrl or cancelUrl is missing and is required for non-zero online payments',
                    human: $t(`ebe54b63-2de6-4f22-a5ed-d3fe65194562`),
                });
            }
        }
        else {
            checkout.paymentMethod = PaymentMethod.Unknown;
        }

        console.log('Registering members using whoWillPayNow', whoWillPayNow, checkout.paymentMethod, totalPrice);

        const createdBalanceItems: BalanceItem[] = [];
        const deletedBalanceItems: BalanceItem[] = [];
        const shouldMarkValid = whoWillPayNow === 'nobody' || checkout.paymentMethod === PaymentMethod.Transfer || checkout.paymentMethod === PaymentMethod.PointOfSale || checkout.paymentMethod === PaymentMethod.Unknown;

        // Create negative balance items
        for (const { registration: registrationStruct, deleted } of [
            ...checkout.cart.deleteRegistrations.map(r => ({ registration: r, deleted: true })),
            ...checkout.cart.items.flatMap(i => i.replaceRegistrations).map(r => ({ registration: r, deleted: false })),
        ]) {
            if (whoWillPayNow !== 'nobody') {
                // this also fixes the issue that we cannot delete the registration right away if we would need to wait for a payment
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'Permission denied: you are not allowed to delete registrations',
                    human: $t(`d47bdfdd-5940-4818-a664-1cd072294a26`),
                    statusCode: 403,
                });
            }

            const existingRegistration = await Registration.getByID(registrationStruct.registration.id);
            if (!existingRegistration || existingRegistration.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`282a7491-d129-4e43-9a14-e55c72ef5c5d`),
                });
            }

            if (!await Context.auth.canAccessRegistration(existingRegistration, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to delete this registration',
                    human: $t(`9b772fd5-a36e-4997-85fa-251bb3a97a0a`),
                    statusCode: 403,
                });
            }

            if (existingRegistration.deactivatedAt || !existingRegistration.registeredAt) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Cannot delete inactive registration',
                    human: $t(`a0f43131-c880-4a8e-98e3-bf78df27336c`),
                });
            }

            // We can alter right away since whoWillPayNow is nobody, and shouldMarkValid will always be true
            // Find all balance items of this registration and set them to Canceled
            if ((deleted ? checkout.cancellationFeePercentage : 0) !== 100_00) {
                // Only cancel balances if we don't charge 100% cancellation fee
                // Also - this avoid creating a new cancellation fee balance item together with canceling the registration balance item, which is more complicated
                deletedBalanceItems.push(...(await BalanceItem.deleteForDeletedRegistration(existingRegistration.id, {
                    cancellationFeePercentage: deleted ? checkout.cancellationFeePercentage : 0,
                })));
            }

            // Clear the registration
            let group = groups.find(g => g.id === existingRegistration.groupId);
            if (!group) {
                group = await Group.getByID(existingRegistration.groupId);
                if (group) {
                    groups.push(group);
                }
            }
            const member = members.find(m => m.id === existingRegistration.memberId);

            await RegistrationService.deactivate(existingRegistration, group, member);
            deactivatedRegistrationGroupIds.push(existingRegistration.groupId);
        }

        async function createBalanceItem({ registration, skipZero, amount, unitPrice, description, type, relations }: { amount?: number; skipZero?: boolean; registration: { id: string; payingOrganizationId: string | null; memberId: string; trialUntil: Date | null }; unitPrice: number; description: string; relations: Map<BalanceItemRelationType, BalanceItemRelation>; type: BalanceItemType }) {
            // NOTE: We also need to save zero-price balance items because for online payments, we need to know which registrations to activate after payment
            if (skipZero === true) {
                if (unitPrice === 0 || amount === 0) {
                    return;
                }
            }

            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.registrationId = registration.id;
            balanceItem.unitPrice = unitPrice;
            balanceItem.amount = amount ?? 1;
            balanceItem.description = description;
            balanceItem.relations = relations;
            balanceItem.type = type;

            // Who needs to receive this money?
            balanceItem.organizationId = organization.id;

            // Who is responsible for payment?
            if (registration.payingOrganizationId) {
                // We no longer also charge the member. This has been removed, ref STA-288
                balanceItem.payingOrganizationId = registration.payingOrganizationId;
            }
            else {
                balanceItem.memberId = registration.memberId;

                if (!checkout.asOrganizationId) {
                    balanceItem.userId = user.id;
                }
            }

            balanceItem.status = BalanceItemStatus.Hidden;
            balanceItem.pricePaid = 0;

            if (registration.trialUntil) {
                balanceItem.dueAt = registration.trialUntil;
            }

            await balanceItem.save();
            createdBalanceItems.push(balanceItem);
        }

        // Save registrations and add extra data if needed
        for (const bundle of payRegistrations) {
            const { item, registration } = bundle;
            registration.reservedUntil = null;

            // Reserve registration for 30 minutes (if needed)
            const group = groups.find(g => g.id === registration.groupId);

            if (group && group.settings.maxMembers !== null && whoWillPayNow !== 'nobody') {
                registration.reservedUntil = new Date(new Date().getTime() + 1000 * 60 * 30);
            }

            // Only now save the registration
            await registration.save();

            // Note: we should always create the balance items: even when the price is zero
            // Otherwise we don't know which registrations to activate after payment

            // Create balance items
            const sharedRelations: [BalanceItemRelationType, BalanceItemRelation][] = [
                [
                    BalanceItemRelationType.Member,
                    BalanceItemRelation.create({
                        id: item.member.id,
                        name: new TranslatedString(item.member.patchedMember.name),
                    }),
                ],
                [
                    BalanceItemRelationType.Group,
                    BalanceItemRelation.create({
                        id: item.group.id,
                        name: item.group.settings.name,
                    }),
                ],
            ];

            if (item.group.settings.prices.length > 1) {
                sharedRelations.push([
                    BalanceItemRelationType.GroupPrice,
                    BalanceItemRelation.create({
                        id: item.groupPrice.id,
                        name: item.groupPrice.name,
                    }),
                ]);
            }

            // Base price
            await createBalanceItem({
                registration,
                unitPrice: item.groupPrice.price.forMember(item.member),
                type: BalanceItemType.Registration,
                skipZero: false, // Always create at least one balance item for each registration - even when the price is zero
                description: `${item.member.patchedMember.name} bij ${item.group.settings.name.toString()}`,
                relations: new Map([
                    ...sharedRelations,
                ]),
            });

            // Options
            for (const option of item.options) {
                await createBalanceItem({
                    registration,
                    amount: option.amount,
                    unitPrice: option.option.price.forMember(item.member),
                    skipZero: true, // Do not create for zero option prices
                    type: BalanceItemType.Registration,
                    description: `${option.optionMenu.name}: ${option.option.name}`,
                    relations: new Map([
                        ...sharedRelations,
                        [
                            BalanceItemRelationType.GroupOptionMenu,
                            BalanceItemRelation.create({
                                id: option.optionMenu.id,
                                name: new TranslatedString(option.optionMenu.name),
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOption,
                            BalanceItemRelation.create({
                                id: option.option.id,
                                name: new TranslatedString(option.option.name),
                            }),
                        ],
                    ]),
                });
            }

            // Discounts
            for (const discount of checkout.cart.bundleDiscounts) {
                const discountValue = discount.getTotalFor(item);

                if (discountValue !== 0) {
                    // Base price
                    await createBalanceItem({
                        registration,
                        unitPrice: -discountValue,
                        type: BalanceItemType.RegistrationBundleDiscount,
                        description: discount.name,
                        relations: new Map([
                            ...sharedRelations,
                            [
                                BalanceItemRelationType.Discount,
                                BalanceItemRelation.create({
                                    id: discount.bundle.id,
                                    name: discount.bundle.name,
                                }),
                            ],
                        ]),
                    });
                }
            }
        }

        // Discounts for existing registrations that have changed
        for (const discount of checkout.cart.bundleDiscounts) {
            const loopMap = new Map(discount.registrations);

            // We'll just cancel discount balance items for deleted registrations instead of creating a counter balance item
            // for (const deleteRegistration of discount.deleteRegistrations) {
            //    loopMap.set(deleteRegistration, 0);
            // }

            for (const [registration, newDiscountValue] of loopMap) {
                const oldDiscountValue = registration.registration.discounts.get(discount.bundle.id)?.amount ?? 0;

                // Saving the discount change directly on the registration now is not safe , because it can only be applied after the payment has succeededs)
                // Solution: let the balance item handle it in its 'paid' handlers
                const difference = newDiscountValue - oldDiscountValue;

                if (difference === 0) {
                    continue;
                }

                // Create balance items
                const sharedRelations: [BalanceItemRelationType, BalanceItemRelation][] = [
                    [
                        BalanceItemRelationType.Member,
                        BalanceItemRelation.create({
                            id: registration.member.id,
                            name: new TranslatedString(registration.member.patchedMember.name),
                        }),
                    ],
                    [
                        BalanceItemRelationType.Group,
                        BalanceItemRelation.create({
                            id: registration.group.id,
                            name: registration.group.settings.name,
                        }),
                    ],
                ];

                if (registration.group.settings.prices.length > 1) {
                    sharedRelations.push([
                        BalanceItemRelationType.GroupPrice,
                        BalanceItemRelation.create({
                            id: registration.registration.groupPrice.id,
                            name: registration.registration.groupPrice.name,
                        }),
                    ]);
                }

                await createBalanceItem({
                    registration: registration.registration,
                    unitPrice: -difference,
                    type: BalanceItemType.RegistrationBundleDiscount,
                    description: discount.name,
                    relations: new Map([
                        ...sharedRelations,
                        [
                            BalanceItemRelationType.Discount,
                            BalanceItemRelation.create({
                                id: discount.bundle.id,
                                name: discount.bundle.name,
                            }),
                        ],
                    ]),
                });
            }
        }

        const oldestMember = members.slice().sort((a, b) => b.details.defaultAge - a.details.defaultAge)[0];
        if (checkout.freeContribution && !request.body.asOrganizationId) {
            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.type = BalanceItemType.FreeContribution;
            balanceItem.unitPrice = checkout.freeContribution;
            balanceItem.description = `Vrije bijdrage`;
            balanceItem.pricePaid = 0;
            balanceItem.userId = user.id;
            balanceItem.organizationId = organization.id;

            // Connect this to the oldest member

            if (oldestMember) {
                balanceItem.memberId = oldestMember.id;
            }
            balanceItem.status = BalanceItemStatus.Hidden;
            await balanceItem.save();
            createdBalanceItems.push(balanceItem);
        }

        if (checkout.administrationFee && whoWillPayNow !== 'nobody') {
            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.type = BalanceItemType.AdministrationFee;
            balanceItem.unitPrice = checkout.administrationFee;
            balanceItem.description = `Administratiekosten`;
            balanceItem.pricePaid = 0;
            balanceItem.organizationId = organization.id;

            if (request.body.asOrganizationId) {
                balanceItem.payingOrganizationId = request.body.asOrganizationId;
            }
            else {
                balanceItem.userId = user.id;

                // Connect this to the oldest member
                if (oldestMember) {
                    balanceItem.memberId = oldestMember.id;
                }
            }

            balanceItem.status = BalanceItemStatus.Hidden;
            await balanceItem.save();

            createdBalanceItems.push(balanceItem);
        }

        if (checkout.cart.balanceItems.length && whoWillPayNow === 'nobody') {
            throw new SimpleError({
                code: 'cannot_pay_balance_items',
                message: 'Not possible to pay balance items as the organization',
                statusCode: 400,
            });
        }

        let paymentUrl: string | null = null;
        let paymentQRCode: string | null = null;
        let payment: Payment | null = null;

        // Delay marking as valid as late as possible so any errors will prevent creating valid balance items
        // Keep a copy because createdBalanceItems will be altered - and we don't want to mark added items as valid
        const markValidList = [...createdBalanceItems];

        async function markValidIfNeeded() {
            if (shouldMarkValid) {
                for (const balanceItem of markValidList) {
                    // Mark valid
                    await BalanceItemService.markPaid(balanceItem, payment, organization);
                }

                // Flush balance caches so we return an up-to-date balance
                await BalanceItemService.flushRegistrationDiscountsCache();

                // We'll need to update the returned registrations as their values will have changed by marking the registration as valid
                await Registration.refreshAll(registrations);
            }
        }

        if (whoWillPayNow !== 'nobody') {
            const mappedBalanceItems = new Map<BalanceItem, number>();

            for (const item of createdBalanceItems) {
                if (item.dueAt === null) {
                    mappedBalanceItems.set(item, item.price);
                }
            }

            for (const item of checkout.cart.balanceItems) {
                const balanceItem = balanceItemsModels.find(i => i.id === item.item.id);
                if (!balanceItem) {
                    throw new Error('Balance item not found');
                }
                mappedBalanceItems.set(balanceItem, item.price);
                createdBalanceItems.push(balanceItem);
            }

            try {
                const response = await this.createPayment({
                    balanceItems: mappedBalanceItems,
                    organization,
                    user,
                    checkout: request.body,
                    members,
                });
                await markValidIfNeeded();

                if (response) {
                    paymentUrl = response.paymentUrl;
                    paymentQRCode = response.paymentQRCode;
                    payment = response.payment;
                }
            }
            finally {
                // Update cached balance items pending amount (only created balance items, because those are involved in the payment)
                await BalanceItemService.updatePaidAndPending(createdBalanceItems);
            }
        }
        else {
            await markValidIfNeeded();
        }

        // Update occupancy
        for (const group of groups) {
            if (registrations.some(r => r.groupId === group.id) || deactivatedRegistrationGroupIds.some(id => id === group.id)) {
                await group.updateOccupancy();
                await group.save();
            }
        }

        const updatedMembers = await Member.getBlobByIds(...members.map(m => m.id));

        return new Response(RegisterResponse.create({
            payment: payment ? PaymentStruct.create(payment) : null,
            members: await AuthenticatedStructures.membersBlob(updatedMembers),
            registrations: registrations.map(r => Member.getRegistrationWithTinyMemberStructure(r)),
            paymentUrl,
            paymentQRCode,
        }));
    }

    async createPayment({ balanceItems, organization, user, checkout, members }: { balanceItems: Map<BalanceItem, number>; organization: Organization; user: User; checkout: IDRegisterCheckout; members: MemberWithRegistrations[] }) {
        // Calculate total price to pay
        let totalPrice = 0;
        const payMembers: MemberWithRegistrations[] = [];
        let hasNegative = false;

        for (const [balanceItem, price] of balanceItems) {
            if (organization.id !== balanceItem.organizationId) {
                throw new Error('Unexpected balance item from other organization');
            }

            if (price > 0 && price > Math.max(balanceItem.priceOpen, balanceItem.price - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`38ddccb2-7cf6-4b47-aa71-d11ad73386d8`),
                });
            }

            if (price < 0 && price < Math.min(balanceItem.priceOpen, balanceItem.price - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`dd14a1d9-c569-4d5e-bb26-569ecede4c52`),
                });
            }

            if (price < 0) {
                hasNegative = true;
            }

            totalPrice += price;

            if (price > 0 && balanceItem.memberId) {
                const member = members.find(m => m.id === balanceItem.memberId);
                if (!member) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: $t(`e64b8269-1cda-434d-8d6f-35be23a9d6e9`),
                    });
                }
                payMembers.push(member);
            }
        }

        if (totalPrice < 0) {
            // todo: try to make it non-negative by reducing some balance items
            throw new SimpleError({
                code: 'negative_price',
                message: $t(`725715e5-b0ac-43c1-adef-dd42b8907327`),
            });
        }

        if (totalPrice !== checkout.totalPrice) {
            // Changed!
            throw new SimpleError({
                code: 'changed_price',
                message: $t(`e424d549-2bb8-4103-9a14-ac4063d7d454`, { total: Formatter.price(totalPrice) }),
            });
        }

        const payment = new Payment();
        payment.method = checkout.paymentMethod ?? PaymentMethod.Unknown;

        if (totalPrice === 0) {
            if (balanceItems.size === 0) {
                return;
            }
            // Create an egalizing payment
            payment.method = PaymentMethod.Unknown;

            if (hasNegative) {
                payment.type = PaymentType.Reallocation;
            }
        }
        else if (payment.method === PaymentMethod.Unknown) {
            throw new SimpleError({
                code: 'invalid_data',
                message: $t(`86c7b6f7-3ec9-4af3-a5e6-b5de6de80d73`),
            });
        }

        // Who will receive this money?
        payment.organizationId = organization.id;

        // Who paid
        payment.payingUserId = user.id;
        payment.payingOrganizationId = checkout.asOrganizationId ?? null;

        // Fill in customer:
        payment.customer = PaymentCustomer.create({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        });

        // Use structured transfer description prefix
        let prefix = '';

        if (checkout.asOrganizationId) {
            if (!checkout.customer) {
                throw new SimpleError({
                    code: 'missing_fields',
                    message: 'customer is required when paying as an organization',
                    human: $t(`d483aa9a-289c-4c59-955f-d2f99ec533ab`),
                });
            }

            if (!checkout.customer.company) {
                throw new SimpleError({
                    code: 'missing_fields',
                    message: 'customer.company is required when paying as an organization',
                    human: $t(`bc89861d-a799-4100-b06c-29d6808ba8d2`),
                });
            }

            const payingOrganization = await Organization.getByID(checkout.asOrganizationId);
            if (!payingOrganization) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`492117ce-4d5f-4cff-8f3f-8fa56bbb0fee`),
                });
            }

            // Search company id
            // this avoids needing to check the VAT number every time
            const id = checkout.customer.company.id;
            const foundCompany = payingOrganization.meta.companies.find(c => c.id === id);

            if (!foundCompany) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`0ab71307-8f4f-4701-b120-b552a1b6bdd0`),
                });
            }

            payment.customer.company = foundCompany;

            const orgNumber = parseInt(payingOrganization.uri);

            if (orgNumber !== 0 && !isNaN(orgNumber)) {
                prefix = orgNumber + '';
            }
        }

        payment.status = PaymentStatus.Created;
        payment.paidAt = null;
        payment.price = totalPrice;

        if (totalPrice === 0) {
            payment.status = PaymentStatus.Succeeded;
            payment.paidAt = new Date();
        }

        if (payment.method === PaymentMethod.Transfer) {
            // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
            payment.transferSettings = organization.mappedTransferSettings;

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: 'no_iban',
                    message: 'No IBAN',
                    human: $t(`cc8b5066-a7e4-4eae-b556-f56de5d3502c`),
                });
            }

            const m = payMembers.map(r => r.details);
            payment.generateDescription(
                organization,
                Formatter.groupNamesByFamily(m),
                {
                    name: Formatter.groupNamesByFamily(m),
                    naam: Formatter.groupNamesByFamily(m),
                    email: user.email,
                    prefix,
                },
            );
        }

        // Determine the payment provider
        // Throws if invalid
        const { provider, stripeAccount } = await organization.getPaymentProviderFor(payment.method, organization.privateMeta.registrationPaymentConfiguration);
        payment.provider = provider;
        payment.stripeAccountId = stripeAccount?.id ?? null;
        ServiceFeeHelper.setServiceFee(payment, organization, 'members', [...balanceItems.entries()].map(([_, p]) => p));

        await payment.save();

        // Create balance item payments
        const balanceItemPayments: (BalanceItemPayment & { balanceItem: BalanceItem })[] = [];

        for (const [balanceItem, price] of balanceItems) {
            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = price;
            await balanceItemPayment.save();

            balanceItemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem));
        }

        const description = $t(`33a926ea-9bc7-444e-becc-c0f2f70e1f0e`) + ' ' + organization.name;

        let paymentUrl: string | null = null;
        let paymentQRCode: string | null = null;

        try {
            // Update balance items
            if (payment.method === PaymentMethod.Transfer) {
                // Send a small reminder email
                try {
                    await Registration.sendTransferEmail(user, organization, payment);
                }
                catch (e) {
                    console.error('Failed to send transfer email');
                    console.error(e);
                }
            }
            else if (payment.method !== PaymentMethod.PointOfSale && payment.method !== PaymentMethod.Unknown) {
                if (!checkout.redirectUrl || !checkout.cancelUrl) {
                    throw new Error('Should have been caught earlier');
                }

                const _redirectUrl = new URL(checkout.redirectUrl);
                _redirectUrl.searchParams.set('paymentId', payment.id);
                _redirectUrl.searchParams.set('organizationId', organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const _cancelUrl = new URL(checkout.cancelUrl);
                _cancelUrl.searchParams.set('paymentId', payment.id);
                _cancelUrl.searchParams.set('cancel', 'true');
                _cancelUrl.searchParams.set('organizationId', organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const redirectUrl = _redirectUrl.href;
                const cancelUrl = _cancelUrl.href;

                const webhookUrl = 'https://' + organization.getApiHost() + '/v' + Version + '/payments/' + encodeURIComponent(payment.id) + '?exchange=true';

                if (payment.provider === PaymentProvider.Stripe) {
                    const stripeResult = await StripeHelper.createPayment({
                        payment,
                        stripeAccount,
                        redirectUrl,
                        cancelUrl,
                        statementDescriptor: organization.name,
                        metadata: {
                            organization: organization.id,
                            user: user.id,
                            payment: payment.id,
                        },
                        i18n: Context.i18n,
                        lineItems: balanceItemPayments,
                        organization,
                        customer: {
                            name: user.name ?? payMembers[0]?.details.name ?? $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
                            email: user.email,
                        },
                    });
                    paymentUrl = stripeResult.paymentUrl;
                }
                else if (payment.provider === PaymentProvider.Mollie) {
                    // Mollie payment
                    const token = await MollieToken.getTokenFor(organization.id);
                    if (!token) {
                        throw new SimpleError({
                            code: '',
                            message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                    const profileId = organization.privateMeta.mollieProfile?.id ?? await token.getProfileId(organization.getHost());
                    if (!profileId) {
                        throw new SimpleError({
                            code: '',
                            message: $t(`5574469f-8eee-47fe-9fb6-1b097142ac75`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                    const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                    const locale = Context.i18n.locale.replace('-', '_');
                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (totalPrice / 100).toFixed(2),
                        },
                        method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : (payment.method == PaymentMethod.iDEAL ? molliePaymentMethod.ideal : molliePaymentMethod.creditcard),
                        testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production',
                        profileId,
                        description,
                        redirectUrl,
                        webhookUrl,
                        metadata: {
                            paymentId: payment.id,
                        },
                        locale: ['en_US', 'en_GB', 'nl_NL', 'nl_BE', 'fr_FR', 'fr_BE', 'de_DE', 'de_AT', 'de_CH', 'es_ES', 'ca_ES', 'pt_PT', 'it_IT', 'nb_NO', 'sv_SE', 'fi_FI', 'da_DK', 'is_IS', 'hu_HU', 'pl_PL', 'lv_LV', 'lt_LT'].includes(locale) ? (locale as any) : null,
                    });
                    paymentUrl = molliePayment.getCheckoutUrl();

                    // Save payment
                    const dbPayment = new MolliePayment();
                    dbPayment.paymentId = payment.id;
                    dbPayment.mollieId = molliePayment.id;
                    await dbPayment.save();
                }
                else if (payment.provider === PaymentProvider.Payconiq) {
                    ({ paymentUrl, paymentQRCode } = await PayconiqPayment.createPayment(payment, organization, description, redirectUrl, webhookUrl));
                }
                else if (payment.provider == PaymentProvider.Buckaroo) {
                    // Increase request timeout because buckaroo is super slow (in development)
                    Context.request.request?.setTimeout(60 * 1000);
                    const buckaroo = new BuckarooHelper(organization.privateMeta?.buckarooSettings?.key ?? '', organization.privateMeta?.buckarooSettings?.secret ?? '', organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
                    const ip = Context.request.getIP();
                    paymentUrl = await buckaroo.createPayment(payment, ip, description, redirectUrl, webhookUrl);
                    await payment.save();

                    // TypeScript doesn't understand that the status can change and isn't a const....
                    if ((payment.status as any) === PaymentStatus.Failed) {
                        throw new SimpleError({
                            code: 'payment_failed',
                            message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                }
            }
        }
        catch (e) {
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
            throw e;
        }

        return {
            payment,
            balanceItemPayments,
            provider,
            stripeAccount,
            paymentUrl,
            paymentQRCode,
        };
    }
}
