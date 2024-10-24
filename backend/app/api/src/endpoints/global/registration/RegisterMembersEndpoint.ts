import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, BalanceItemPayment, Group, Member, MemberWithRegistrations, MolliePayment, MollieToken, Organization, PayconiqPayment, Payment, Platform, RateLimiter, Registration, User } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, IDRegisterCheckout, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, Payment as PaymentStruct, PermissionLevel, PlatformFamily, PlatformMember, RegisterItem, RegisterResponse, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { BuckarooHelper } from '../../../helpers/BuckarooHelper';
import { Context } from '../../../helpers/Context';
import { StripeHelper } from '../../../helpers/StripeHelper';
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
                    human: 'Oops! Je gebruikt een oude versie van de applicatie om in te schrijven. Herlaad de website en verwijder indien nodig de cache van jouw browser.',
                });
            }
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (request.body.asOrganizationId && request.body.asOrganizationId !== organization.id) {
            if (!await Context.auth.canManageFinances(request.body.asOrganizationId)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to register as this organization for a different organization',
                    human: 'Je hebt niet de juiste toegangsrechten om leden in te schrijven bij een andere organisatie.',
                    statusCode: 403,
                });
            }
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
                    human: 'Oeps! Om spam te voorkomen limiteren we het aantal test inschrijvingen die je per uur of dag kan plaatsen. Probeer over een uur opnieuw of schakel over naar een betaald abonnement.',
                    field: 'recipients',
                });
            }
        }

        const deleteRegistrationIds = request.body.cart.deleteRegistrationIds;
        const deleteRegistrationModels = (deleteRegistrationIds.length ? (await Registration.getByIDs(...deleteRegistrationIds)) : []).filter(r => r.organizationId === organization.id);

        // Validate balance items (can only happen serverside)
        const balanceItemIds = request.body.cart.balanceItems.map(i => i.item.id);
        let memberBalanceItemsStructs: BalanceItemWithPayments[] = [];
        let balanceItemsModels: BalanceItem[] = [];
        if (balanceItemIds.length > 0) {
            balanceItemsModels = await BalanceItem.where({ id: { sign: 'IN', value: balanceItemIds }, organizationId: organization.id });
            if (balanceItemsModels.length !== balanceItemIds.length) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, één of meerdere openstaande bedragen in jouw winkelmandje zijn aangepast. Herlaad de pagina en probeer opnieuw.',
                });
            }
            memberBalanceItemsStructs = await BalanceItem.getStructureWithPayments(balanceItemsModels);
        }

        const memberIds = Formatter.uniqueArray(
            [...request.body.memberIds, ...deleteRegistrationModels.map(i => i.memberId), ...balanceItemsModels.map(i => i.memberId).filter(m => m !== null)],
        );
        const members = await Member.getBlobByIds(...memberIds);
        const groupIds = request.body.groupIds;
        const groups = await Group.getByIDs(...groupIds);

        for (const group of groups) {
            if (group.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, één of meerdere groepen waarin je probeert in te schrijven lijken niet meer te bestaan. Herlaad de pagina en probeer opnieuw.',
                });
            }
        }

        for (const member of members) {
            if (!await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'No permission to register this member',
                    human: 'Je hebt niet de juiste toegangsrechten om dit lid in te schrijven. Je kan enkel leden inschrijven als je minstens bewerkrechten hebt voor dat lid.',
                    statusCode: 403,
                });
            }
        }

        const blob = await AuthenticatedStructures.membersBlob(members, true);
        const platformMembers: PlatformMember[] = [];

        if (request.body.asOrganizationId) {
            const _m = PlatformFamily.createSingles(blob, {
                platform: await Platform.getSharedStruct(),
                contextOrganization: await AuthenticatedStructures.organization(organization),
            });
            platformMembers.push(..._m);
        }
        else {
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
                message: 'Oeps, jouw mandje is leeg. Voeg eerst inschrijvingen toe voor je verder gaat.',
            });
        }

        // Validate the cart
        checkout.validate({ memberBalanceItems: memberBalanceItemsStructs });

        // Recalculate the price
        checkout.updatePrices();

        const totalPrice = checkout.totalPrice;

        if (totalPrice !== request.body.totalPrice) {
            throw new SimpleError({
                code: 'changed_price',
                message: 'Oeps! De prijs is gewijzigd terwijl je aan het afrekenen was (naar ' + Formatter.price(totalPrice) + '). Herlaad de pagina even om ervoor te zorgen dat je alle aangepaste prijzen ziet. Contacteer de webmaster als je dit probleem blijft ondervinden na het te herladen.',
            });
        }

        if (totalPrice < 0) {
            throw new SimpleError({
                code: 'empty_data',
                message: 'Oeps! De totaalprijs is negatief.',
            });
        }

        const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
        registrationMemberRelation.foreignKey = 'memberId';

        for (const item of checkout.cart.items) {
            const member = members.find(m => m.id == item.memberId);
            if (!member) {
                throw new SimpleError({
                    code: 'invalid_member',
                    message: 'Het lid dat je probeert in te schrijven konden we niet meer terugvinden. Je herlaadt best even de pagina om opnieuw te proberen.',
                });
            }

            const group = groups.find(g => g.id == item.groupId);
            if (!group) {
                throw new SimpleError({
                    code: 'invalid_member',
                    message: 'De groep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen.',
                });
            }

            // Check if this member is already registered in this group?
            const existingRegistrations = await Registration.where({ memberId: member.id, groupId: item.groupId, cycle: group.cycle });

            for (const existingRegistration of existingRegistrations) {
                if (item.replaceRegistrations.some(r => r.id === existingRegistration.id)) {
                    // Safe
                    continue;
                }

                if (checkout.cart.deleteRegistrations.some(r => r.id === existingRegistration.id)) {
                    // Safe
                    continue;
                }

                if (existingRegistration.registeredAt !== null && existingRegistration.deactivatedAt === null) {
                    throw new SimpleError({
                        code: 'already_registered',
                        message: `${member.firstName} is al ingeschreven voor ${group.settings.name}. Mogelijks heb je meerdere keren proberen in te schrijven en is het intussen wel gelukt. Herlaad de pagina best even om zeker te zijn.`,
                    });
                }
            }

            const registration = new Registration()
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

            payRegistrations.push({
                registration,
                item,
            });

            registrations.push(registration);
        }

        // Who is going to pay?
        let whoWillPayNow: 'member' | 'organization' | 'nobody' = 'member'; // if this is set to 'organization', there will also be created separate balance items so the member can pay back the paying organization

        if (request.body.asOrganizationId && request.body.asOrganizationId === organization.id) {
            // Will get added to the outstanding amount of the member
            whoWillPayNow = 'nobody';
        }
        else if (request.body.asOrganizationId && request.body.asOrganizationId !== organization.id) {
            // The organization will pay to the organizing organization, and it will get added to the outstanding amount of the member towards the paying organization
            whoWillPayNow = 'organization';
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
                    message: 'Oeps, je hebt geen geldige betaalmethode geselecteerd. Selecteer een betaalmethode en probeer opnieuw. Herlaad de pagina indien nodig.',
                });
            }

            if ((checkout.paymentMethod !== PaymentMethod.Transfer && checkout.paymentMethod !== PaymentMethod.PointOfSale) && (!request.body.redirectUrl || !request.body.cancelUrl)) {
                throw new SimpleError({
                    code: 'missing_fields',
                    message: 'redirectUrl or cancelUrl is missing and is required for non-zero online payments',
                    human: 'Er is iets mis. Contacteer de webmaster.',
                });
            }
        }
        else {
            checkout.paymentMethod = PaymentMethod.Unknown;
        }

        console.log('Registering members using whoWillPayNow', whoWillPayNow, checkout.paymentMethod, totalPrice);

        const createdBalanceItems: BalanceItem[] = [];
        const unrelatedCreatedBalanceItems: BalanceItem[] = [];
        const shouldMarkValid = whoWillPayNow === 'nobody' || checkout.paymentMethod === PaymentMethod.Transfer || checkout.paymentMethod === PaymentMethod.PointOfSale || checkout.paymentMethod === PaymentMethod.Unknown;

        // Create negative balance items
        for (const registrationStruct of [...checkout.cart.deleteRegistrations, ...checkout.cart.items.flatMap(i => i.replaceRegistrations)]) {
            if (whoWillPayNow !== 'nobody') {
                // this also fixes the issue that we cannot delete the registration right away if we would need to wait for a payment
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'Permission denied: you are not allowed to delete registrations',
                    human: 'Oeps, je hebt geen toestemming om inschrijvingen te verwijderen.',
                    statusCode: 403,
                });
            }

            const existingRegistration = await Registration.getByID(registrationStruct.id);
            if (!existingRegistration || existingRegistration.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, één of meerdere inschrijvingen die je probeert te verwijderen lijken niet meer te bestaan. Herlaad de pagina en probeer opnieuw.',
                });
            }

            if (!await Context.auth.canAccessRegistration(existingRegistration, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: 'forbidden',
                    message: 'Je hebt geen toegaansrechten om deze inschrijving te verwijderen.',
                    statusCode: 403,
                });
            }

            if (existingRegistration.deactivatedAt || !existingRegistration.registeredAt) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, één of meerdere inschrijvingen die je probeert te verwijderen was al verwijderd. Herlaad de pagina en probeer opnieuw.',
                });
            }

            // We can alter right away since whoWillPayNow is nobody, and shouldMarkValid will always be true
            // Find all balance items of this registration and set them to zero
            await BalanceItem.deleteForDeletedRegistration(existingRegistration.id);

            // Clear the registration
            await existingRegistration.deactivate();
            deactivatedRegistrationGroupIds.push(existingRegistration.groupId);

            const group = groups.find(g => g.id === existingRegistration.groupId);
            if (!group) {
                const g = await Group.getByID(existingRegistration.groupId);
                if (g) {
                    groups.push(g);
                }
            }
        }

        async function createBalanceItem({ registration, amount, unitPrice, description, type, relations }: { amount?: number; registration: RegistrationWithMemberAndGroup; unitPrice: number; description: string; relations: Map<BalanceItemRelationType, BalanceItemRelation>; type: BalanceItemType }) {
            // NOTE: We also need to save zero-price balance items because for online payments, we need to know which registrations to activate after payment

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
            let balanceItem2: BalanceItem | null = null;
            if (whoWillPayNow === 'organization' && request.body.asOrganizationId) {
                // Create a separate balance item for this meber to pay back the paying organization
                // this is not yet associated with a payment but will be added to the outstanding balance of the member

                balanceItem.payingOrganizationId = request.body.asOrganizationId;

                balanceItem2 = new BalanceItem();

                // NOTE: we don't connect the registrationId here
                // because otherwise the total price and pricePaid for the registration would be incorrect
                // balanceItem2.registrationId = registration.id;

                balanceItem2.unitPrice = unitPrice;
                balanceItem2.amount = amount ?? 1;
                balanceItem2.description = description;
                balanceItem2.relations = relations;
                balanceItem2.type = type;

                // Who needs to receive this money?
                balanceItem2.organizationId = request.body.asOrganizationId;

                // Who is responsible for payment?
                balanceItem2.memberId = registration.memberId;

                // If the paying organization hasn't paid yet, this should be hidden and move to pending as soon as the paying organization has paid
                balanceItem2.status = shouldMarkValid ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden;
                await balanceItem2.save();

                // do not add to createdBalanceItems array because we don't want to add this to the payment if we create a payment
                unrelatedCreatedBalanceItems.push(balanceItem2);
            }
            else {
                balanceItem.memberId = registration.memberId;
                balanceItem.userId = user.id;
            }

            balanceItem.status = shouldMarkValid ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden;
            balanceItem.pricePaid = 0;

            // Connect the 'pay back' balance item to this balance item. As soon as this balance item is paid, we'll mark the other one as pending so the outstanding balance for the member increases
            balanceItem.dependingBalanceItemId = balanceItem2?.id ?? null;

            await balanceItem.save();
            createdBalanceItems.push(balanceItem);
        }

        // Save registrations and add extra data if needed
        for (const bundle of payRegistrations) {
            const { item, registration } = bundle;
            registration.reservedUntil = null;

            if (shouldMarkValid) {
                await registration.markValid({ skipEmail: bundle.item.replaceRegistrations.length > 0 });
            }
            else {
                // Reserve registration for 30 minutes (if needed)
                const group = groups.find(g => g.id === registration.groupId);

                if (group && group.settings.maxMembers !== null) {
                    registration.reservedUntil = new Date(new Date().getTime() + 1000 * 60 * 30);
                }
                await registration.save();
            }

            // Note: we should always create the balance items: even when the price is zero
            // Otherwise we don't know which registrations to activate after payment

            if (shouldMarkValid && item.calculatedPrice === 0) {
                continue;
            }

            // Create balance items
            const sharedRelations: [BalanceItemRelationType, BalanceItemRelation][] = [
                [
                    BalanceItemRelationType.Member,
                    BalanceItemRelation.create({
                        id: item.member.id,
                        name: item.member.patchedMember.name,
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
                description: `${item.member.patchedMember.name} bij ${item.group.settings.name}`,
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
                    type: BalanceItemType.Registration,
                    description: `${option.optionMenu.name}: ${option.option.name}`,
                    relations: new Map([
                        ...sharedRelations,
                        [
                            BalanceItemRelationType.GroupOptionMenu,
                            BalanceItemRelation.create({
                                id: option.optionMenu.id,
                                name: option.optionMenu.name,
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOption,
                            BalanceItemRelation.create({
                                id: option.option.id,
                                name: option.option.name,
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
            balanceItem.status = shouldMarkValid ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden;
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

            balanceItem.status = shouldMarkValid ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden;
            await balanceItem.save();

            createdBalanceItems.push(balanceItem);
        }

        if (checkout.cart.balanceItems.length && whoWillPayNow === 'nobody') {
            throw new SimpleError({
                code: 'invalid_data',
                message: 'Not possible to pay balance items as the organization',
                statusCode: 400,
            });
        }

        let paymentUrl: string | null = null;
        let payment: Payment | null = null;

        if (whoWillPayNow !== 'nobody') {
            const mappedBalanceItems = new Map<BalanceItem, number>();

            for (const item of createdBalanceItems) {
                mappedBalanceItems.set(item, item.price);
            }

            for (const item of checkout.cart.balanceItems) {
                const balanceItem = balanceItemsModels.find(i => i.id === item.item.id);
                if (!balanceItem) {
                    throw new Error('Balance item not found');
                }
                mappedBalanceItems.set(balanceItem, item.price);
                createdBalanceItems.push(balanceItem);
            }

            // Make sure every price is accurate before creating a payment
            await BalanceItem.updateOutstanding([...createdBalanceItems, ...unrelatedCreatedBalanceItems]);
            try {
                const response = await this.createPayment({
                    balanceItems: mappedBalanceItems,
                    organization,
                    user,
                    checkout: request.body,
                    members,
                });

                if (response) {
                    paymentUrl = response.paymentUrl;
                    payment = response.payment;
                }
            }
            finally {
                // Update cached balance items pending amount (only created balance items, because those are involved in the payment)
                await BalanceItem.updateOutstanding(createdBalanceItems);
            }
        }
        else {
            await BalanceItem.updateOutstanding([...createdBalanceItems, ...unrelatedCreatedBalanceItems]);
        }

        // Update occupancy
        for (const group of groups) {
            if (registrations.some(r => r.groupId === group.id) || deactivatedRegistrationGroupIds.some(id => id === group.id)) {
                await group.updateOccupancy();
                await group.save();
            }
        }

        const updatedMembers = await Member.getBlobByIds(...memberIds);

        return new Response(RegisterResponse.create({
            payment: payment ? PaymentStruct.create(payment) : null,
            members: await AuthenticatedStructures.membersBlob(updatedMembers),
            registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r)),
            paymentUrl,
        }));
    }

    async createPayment({ balanceItems, organization, user, checkout, members }: { balanceItems: Map<BalanceItem, number>; organization: Organization; user: User; checkout: IDRegisterCheckout; members: MemberWithRegistrations[] }) {
        // Calculate total price to pay
        let totalPrice = 0;
        const payMembers: MemberWithRegistrations[] = [];

        for (const [balanceItem, price] of balanceItems) {
            if (organization.id !== balanceItem.organizationId) {
                throw new Error('Unexpected balance item from other organization');
            }

            if (price > 0 && price > Math.max(balanceItem.priceOpen, balanceItem.price - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, het bedrag dat je probeert te betalen is ongeldig (het bedrag is hoger dan het bedrag dat je moet betalen). Herlaad de pagina en probeer opnieuw.',
                });
            }

            if (price < 0 && price < Math.min(balanceItem.priceOpen, balanceItem.price - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, het bedrag dat je probeert te betalen is ongeldig (het terug te krijgen bedrag is hoger dan het bedrag dat je kan terug krijgen). Herlaad de pagina en probeer opnieuw.',
                });
            }

            totalPrice += price;

            if (price > 0 && balanceItem.memberId) {
                const member = members.find(m => m.id === balanceItem.memberId);
                if (!member) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: 'Oeps, het lid dat je probeert in te schrijven konden we niet meer terugvinden. Je herlaadt best even de pagina om opnieuw te proberen.',
                    });
                }
                payMembers.push(member);
            }
        }

        if (totalPrice < 0) {
            // No payment needed: the outstanding balance will be negative and can be used in the future
            return;
            // throw new SimpleError({
            //     code: "empty_data",
            //     message: "Oeps! De totaalprijs is negatief."
            // })
        }

        if (totalPrice === 0) {
            return;
        }

        if (!checkout.paymentMethod || checkout.paymentMethod === PaymentMethod.Unknown) {
            throw new SimpleError({
                code: 'invalid_data',
                message: 'Oeps, je hebt geen betaalmethode geselecteerd. Selecteer een betaalmethode en probeer opnieuw.',
            });
        }

        const payment = new Payment();

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
                    human: 'Vul je facturatiegegevens in om verder te gaan.',
                });
            }

            if (!checkout.customer.company) {
                throw new SimpleError({
                    code: 'missing_fields',
                    message: 'customer.company is required when paying as an organization',
                    human: 'Als je een betaling uitvoert in naam van je vereniging, is het noodzakelijk om facturatiegegevens met bedrijfsgegevens in te vullen.',
                });
            }

            const payingOrganization = await Organization.getByID(checkout.asOrganizationId);
            if (!payingOrganization) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, de organisatie waarvoor je probeert te betalen lijkt niet meer te bestaan. Herlaad de pagina en probeer opnieuw.',
                });
            }

            // Search company id
            // this avoids needing to check the VAT number every time
            const id = checkout.customer.company.id;
            const foundCompany = payingOrganization.meta.companies.find(c => c.id === id);

            if (!foundCompany) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Oeps, de facturatiegegevens die je probeerde te selecteren lijken niet meer te bestaan. Herlaad de pagina en probeer opnieuw.',
                });
            }

            payment.customer.company = foundCompany;

            const orgNumber = parseInt(payingOrganization.uri);

            if (orgNumber !== 0 && !isNaN(orgNumber)) {
                prefix = orgNumber + '';
            }
        }

        payment.method = checkout.paymentMethod;
        payment.status = PaymentStatus.Created;
        payment.price = totalPrice;

        if (payment.method == PaymentMethod.Transfer) {
            // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
            payment.transferSettings = organization.mappedTransferSettings;

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: 'no_iban',
                    message: 'No IBAN',
                    human: 'Er is geen rekeningnummer ingesteld voor overschrijvingen. Contacteer de beheerder.',
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
        payment.paidAt = null;

        // Determine the payment provider
        // Throws if invalid
        const { provider, stripeAccount } = await organization.getPaymentProviderFor(payment.method, organization.privateMeta.registrationPaymentConfiguration);
        payment.provider = provider;
        payment.stripeAccountId = stripeAccount?.id ?? null;

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

        const description = 'Inschrijving ' + organization.name;

        let paymentUrl: string | null = null;

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
        else if (payment.method !== PaymentMethod.PointOfSale) {
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
                        name: user.name ?? payMembers[0]?.details.name ?? 'Onbekend',
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
                        message: 'Betaling via ' + PaymentMethodHelper.getName(payment.method) + ' is onbeschikbaar',
                    });
                }
                const profileId = organization.privateMeta.mollieProfile?.id ?? await token.getProfileId(organization.getHost());
                if (!profileId) {
                    throw new SimpleError({
                        code: '',
                        message: 'Betaling via ' + PaymentMethodHelper.getName(payment.method) + ' is tijdelijk onbeschikbaar',
                    });
                }
                const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
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
                });
                paymentUrl = molliePayment.getCheckoutUrl();

                // Save payment
                const dbPayment = new MolliePayment();
                dbPayment.paymentId = payment.id;
                dbPayment.mollieId = molliePayment.id;
                await dbPayment.save();
            }
            else if (payment.provider === PaymentProvider.Payconiq) {
                paymentUrl = await PayconiqPayment.createPayment(payment, organization, description, redirectUrl, webhookUrl);
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
                        message: 'Betaling via ' + PaymentMethodHelper.getName(payment.method) + ' is onbeschikbaar',
                    });
                }
            }
        }

        return {
            payment,
            balanceItemPayments,
            provider,
            stripeAccount,
            paymentUrl,
        };
    }
}
