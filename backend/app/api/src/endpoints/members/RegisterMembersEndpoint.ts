import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Document, Group, Member, MolliePayment, MollieToken, PayconiqPayment, Payment, Registration, Token } from '@stamhoofd/models';
import { BalanceItemStatus, IDRegisterCheckout, IDRegisterItem, MemberBalanceItem, Payment as PaymentStruct, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, RegisterResponse, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { BuckarooHelper } from '../../helpers/BuckarooHelper';
import { StripeHelper } from '../../helpers/StripeHelper';
import { ExchangePaymentEndpoint } from '../payments/ExchangePaymentEndpoint';
type Params = Record<string, never>;
type Query = undefined;
type Body = IDRegisterCheckout
type ResponseBody = RegisterResponse

export type RegistrationWithMemberAndGroup = Registration & { member: Member } & { group: Group }

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class RegisterMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = IDRegisterCheckout as Decoder<IDRegisterCheckout>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members/register", {});

        if (params) {
            if (request.getVersion() < 71) {
                throw new SimpleError({
                    code: "not_supported",
                    message: "This version is no longer supported",
                    human: "Oops! Je gebruikt een oude versie van de applicatie om in te schrijven. Herlaad de website en verwijder indien nodig de cache van jouw browser."
                })
            }
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.request.getVersion() < 71) {
            throw new SimpleError({
                code: "not_supported",
                message: "This version is no longer supported",
                human: "Oops! Je gebruikt een oude versie van de applicatie om in te schrijven. Herlaad de website en verwijder indien nodig de cache van jouw browser."
            })
        }
        const token = await Token.authenticate(request);
        const user = token.user

        const organization = user.organization

        const members = await Member.getMembersWithRegistrationForUser(user)
        const groups = await Group.getAll(user.organizationId)
        
        const registrations: RegistrationWithMemberAndGroup[] = []
        const payRegistrations: {registration: RegistrationWithMemberAndGroup, item: IDRegisterItem}[] = []

        if (request.body.cart.isEmpty) {
            throw new SimpleError({
                code: "empty_data",
                message: "Oeps, jouw mandje is leeg. Voeg eerst inschrijvingen toe voor je verder gaat."
            })
        }

        // Update occupancies
        // TODO: might not be needed in the future (for performance)
        for (const group of groups) {
            if (request.body.cart.items.find(i => i.groupId == group.id)) {
                await group.updateOccupancy()
                // no need to save yet
                // await group.save()
            }
        }

        // Save the price that the client did calculate (to alert price changes before we continue)
        const clientSidePrice = request.body.cart.price

        // Should update the calculation methods to also accept a model by using interfaces
        const groupsStructure = groups.map(g => g.getStructure())

        // Validate balance items (can only happen serverside)
        const balanceItemIds = request.body.cart.balanceItems.map(i => i.item.id)
        let memberBalanceItems: MemberBalanceItem[] = []
        let balanceItems: BalanceItem[] = []
        if (balanceItemIds.length > 0) {
            balanceItems = await BalanceItem.where({ id: { sign:'IN', value: balanceItemIds }, organizationId: organization.id })
            if (balanceItems.length != balanceItemIds.length) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "Oeps, één of meerdere openstaande bedragen in jouw winkelmandje zijn aangepast. Herlaad de pagina en probeer opnieuw."
                })
            }
            memberBalanceItems = await BalanceItem.getMemberStructure(balanceItems)
        }

        // Validate the cart
        request.body.cart.validate(members, groupsStructure, organization.meta.categories, memberBalanceItems)

        // Recalculate the price
        request.body.cart.calculatePrices(members, groupsStructure, organization.meta.categories)

        const totalPrice = request.body.cart.price
        if (totalPrice !== clientSidePrice) {
            throw new SimpleError({
                code: "empty_data",
                message: "Oeps! De prijs is gewijzigd terwijl je aan het inschrijven was. De totaalprijs kwam op "+Formatter.price(totalPrice)+", in plaats van "+Formatter.price(clientSidePrice)+". Herlaad je pagina en probeer opnieuw om de aanpassingen te zien doorkomen. Daarna kan je verder met inschrijven. Neem contact op met "+request.$t("shared.emails.general")+" als je dit probleem blijft krijgen."
            })
        }

        if (totalPrice < 0) {
            throw new SimpleError({
                code: "empty_data",
                message: "Oeps! De totaalprijs is negatief."
            })
        }

        const registrationGroupRelation = new ManyToOneRelation(Group, "group")
        registrationGroupRelation.foreignKey = "groupId"

        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = "memberId"

        mainLoop: for (const item of request.body.cart.items) {
            const member = members.find(m => m.id == item.memberId)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "Het lid dat je probeert in te schrijven konden we niet meer terugvinden. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            const group = groups.find(g => g.id == item.groupId);
            if (!group) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "De groep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            // Check if this member is already registered in this group?
            const existingRegistrations = await Registration.where({ memberId: member.id, groupId: item.groupId, cycle: group.cycle })
            let registration: RegistrationWithMemberAndGroup | undefined = undefined;

            for (const existingRegistration of existingRegistrations) {
                registration = existingRegistration
                    .setRelation(registrationMemberRelation, member as Member)
                    .setRelation(registrationGroupRelation, group)

                if (existingRegistration.waitingList && item.waitingList) {
                    // already on waiting list, no need to repeat it
                    // skip without error
                    registrations.push(registration)
                    continue mainLoop;
                }

                if (!existingRegistration.waitingList && existingRegistration.registeredAt !== null) {
                    // already registered, no need to put it on the waiting list or register (and pay) again
                    registrations.push(registration)
                    continue mainLoop;
                }
            }

            if (!registration) {
                registration = new Registration()
                    .setRelation(registrationMemberRelation, member as Member)
                    .setRelation(registrationGroupRelation, group)
            }

            registration.memberId = member.id
            registration.groupId = group.id
            registration.cycle = group.cycle

            if (item.waitingList) {
                registration.waitingList = true
                registration.reservedUntil = null
                await registration.save()
            } else {
                registration.waitingList = false
                registration.canRegister = false
                registration.price = item.calculatedPrice
                payRegistrations.push({
                    registration,
                    item
                });
            }
            registrations.push(registration)
        }

        // Validate payment method
        if (totalPrice > 0) {
            const allowedPaymentMethods = organization.meta.paymentMethods

            if (!allowedPaymentMethods.includes(request.body.paymentMethod)) {
                throw new SimpleError({
                    code: "invalid_payment_method",
                    message: "Oeps, je hebt geen geldige betaalmethode geselecteerd. Selecteer een betaalmethode en probeer opnieuw. Herlaad de pagina indien nodig."
                })
            }
        } else {
            request.body.paymentMethod = PaymentMethod.Unknown
        }

        const payment = new Payment()
        payment.userId = user.id
        payment.organizationId = user.organizationId
        payment.method = request.body.paymentMethod
        payment.status = PaymentStatus.Created
        payment.price = totalPrice
        payment.freeContribution = request.body.cart.freeContribution

        if (payment.method == PaymentMethod.Transfer) {
            // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
            payment.transferSettings = user.organization.mappedTransferSettings

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: "no_iban",
                    message: "No IBAN",
                    human: "Er is geen rekeningnummer ingesteld voor overschrijvingen. Contacteer de beheerder."
                })
            }

            const m = [...payRegistrations.map(r => r.registration.member.details), ...memberBalanceItems.map(i => members.find(m => m.id === i.memberId)?.details).filter(n => n !== undefined)]
            payment.generateDescription(
                user.organization, 
                Formatter.groupNamesByFamily(m as any),
                {
                    name: Formatter.groupNamesByFamily(m as any),
                    naam:  Formatter.groupNamesByFamily(m as any),
                    email: user.email
                }
            )
        }
        payment.paidAt = null

        if (totalPrice == 0) {
            payment.status = PaymentStatus.Succeeded
            payment.method = PaymentMethod.Unknown
            payment.paidAt = new Date()
        }

        // Determine the payment provider
        // Throws if invalid
        const {provider, stripeAccount} = await organization.getPaymentProviderFor(payment.method, organization.privateMeta.registrationPaymentConfiguration)
        payment.provider = provider
        payment.stripeAccountId = stripeAccount?.id ?? null

        await payment.save()
        const items: BalanceItem[] = []
        const itemPayments: (BalanceItemPayment & { balanceItem: BalanceItem })[] = []

        // Save registrations and add extra data if needed
        for (const bundle of payRegistrations) {
            const registration = bundle.registration;

            if (!registration.waitingList) {
                // Replaced with balance items
                // registration.paymentId = payment.id

                registration.reservedUntil = null

                if (payment.method == PaymentMethod.Transfer || payment.method == PaymentMethod.PointOfSale || payment.status == PaymentStatus.Succeeded) {
                    await registration.markValid()
                } else {
                    // Reserve registration for 30 minutes (if needed)
                    const group = groups.find(g => g.id === registration.groupId)

                    if (group && group.settings.maxMembers !== null) {
                        registration.reservedUntil = new Date(new Date().getTime() + 1000*60*30)
                    }
                    await registration.save()
                }
            }
            
            await registration.save()

            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.registrationId = registration.id;
            balanceItem.price = bundle.item.calculatedPrice
            balanceItem.description = `Inschrijving ${registration.group.settings.name}`
            balanceItem.pricePaid = payment.status == PaymentStatus.Succeeded ? bundle.item.calculatedPrice : 0;
            balanceItem.memberId = registration.memberId;
            balanceItem.userId = user.id
            balanceItem.organizationId = organization.id;
            balanceItem.status = payment.status == PaymentStatus.Succeeded ? BalanceItemStatus.Paid : (registration.registeredAt ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden);
            await balanceItem.save();

            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment()
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = balanceItem.price;
            await balanceItemPayment.save();

            items.push(balanceItem)
            itemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem))
        }
        
        const oldestMember = members.slice().sort((a, b) => b.details.defaultAge - a.details.defaultAge)[0]
        if (request.body.cart.freeContribution) {
            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.price = request.body.cart.freeContribution
            balanceItem.description = `Vrije bijdrage`
            balanceItem.pricePaid = payment.status == PaymentStatus.Succeeded ? balanceItem.price : 0;
            balanceItem.userId = user.id
            balanceItem.organizationId = organization.id;

            // Connect this to the oldest member
            
            if (oldestMember) {
                balanceItem.memberId = oldestMember.id;
            }
            balanceItem.status = (payment.method == PaymentMethod.Transfer || payment.method == PaymentMethod.PointOfSale ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden);
            await balanceItem.save();

            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment()
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = balanceItem.price;
            await balanceItemPayment.save();

            items.push(balanceItem)
            itemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem))
        }

        // Create a payment pending balance item
        for (const item of request.body.cart.balanceItems) {
            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment()
            balanceItemPayment.balanceItemId = item.item.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = item.price;
            await balanceItemPayment.save();

            const balanceItem = balanceItems.find(i => i.id === item.item.id)
            if (!balanceItem) {
                throw new Error('Balance item not found')
            }
            itemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem))
        }
        items.push(...balanceItems)
        await ExchangePaymentEndpoint.updateOutstanding(items, organization.id)

        // Update occupancy
        for (const group of groups) {
            if (registrations.find(p => p.groupId === group.id)) {
                await group.updateOccupancy()
                await group.save()
            }
        }

        // Update balance items
        if (payment.method == PaymentMethod.Transfer) {
            // Send a small reminder email
            await Registration.sendTransferEmail(user, payment)
        }

        let paymentUrl: string | null = null
        const description = 'Inschrijving '+user.organization.name
        if (payment.status != PaymentStatus.Succeeded) {
            const redirectUrl = "https://"+user.organization.getHost()+'/payment?id='+encodeURIComponent(payment.id)
            const cancelUrl = "https://"+user.organization.getHost()+'/payment?id='+encodeURIComponent(payment.id) + '&cancel=true'
            const webhookUrl = 'https://'+user.organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true"

            if (payment.provider === PaymentProvider.Stripe) {
                const stripeResult = await StripeHelper.createPayment({
                    payment,
                    stripeAccount,
                    redirectUrl,
                    cancelUrl,
                    statementDescriptor: user.organization.name,
                    metadata: {
                        organization: organization.id,
                        user: user.id,
                    },
                    i18n: request.i18n,
                    lineItems: itemPayments,
                    organization,
                    customer: {
                        name: user.firstName ? user.firstName : (user.lastName ? user.lastName : (oldestMember ? oldestMember.details.name : "")),
                        email: user.email,
                    }
                });
                paymentUrl = stripeResult.paymentUrl
            } else if (payment.provider === PaymentProvider.Mollie) {
                
                // Mollie payment
                const token = await MollieToken.getTokenFor(user.organizationId)
                if (!token) {
                    throw new SimpleError({
                        code: "",
                        message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                    })
                }
                const profileId = organization.privateMeta.mollieProfile?.id ?? await token.getProfileId(organization.getHost())
                if (!profileId) {
                    throw new SimpleError({
                        code: "",
                        message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is tijdelijk onbeschikbaar"
                    })
                }
                const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                const molliePayment = await mollieClient.payments.create({
                    amount: {
                        currency: 'EUR',
                        value: (totalPrice / 100).toFixed(2)
                    },
                    method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : (payment.method == PaymentMethod.iDEAL ? molliePaymentMethod.ideal : molliePaymentMethod.creditcard),
                    testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production',
                    profileId,
                    description,
                    redirectUrl,
                    webhookUrl,
                    metadata: {
                        paymentId: payment.id,
                    },
                });
                paymentUrl = molliePayment.getCheckoutUrl()

                // Save payment
                const dbPayment = new MolliePayment()
                dbPayment.paymentId = payment.id
                dbPayment.mollieId = molliePayment.id
                await dbPayment.save();
            } else if (payment.provider === PaymentProvider.Payconiq) {
                paymentUrl = await PayconiqPayment.createPayment(payment, user.organization, description, redirectUrl, webhookUrl)
            } else if (payment.provider == PaymentProvider.Buckaroo) {
                // Increase request timeout because buckaroo is super slow (in development)
                request.request.request?.setTimeout(60 * 1000)
                const buckaroo = new BuckarooHelper(organization.privateMeta?.buckarooSettings?.key ?? "", organization.privateMeta?.buckarooSettings?.secret ?? "", organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')
                const ip = request.request.getIP()
                paymentUrl = await buckaroo.createPayment(payment, ip, description, redirectUrl, webhookUrl)
                await payment.save()

                // TypeScript doesn't understand that the status can change and isn't a const....
                if ((payment.status as any) === PaymentStatus.Failed) {
                    throw new SimpleError({
                        code: "payment_failed",
                        message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                    })
                }
            }
        }

        return new Response(RegisterResponse.create({
            payment: PaymentStruct.create(payment),
            members: (await Member.getMembersWithRegistrationForUser(user)).map(m => m.getStructureWithRegistrations()),
            registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r)),
            paymentUrl
        }));
    }
}
