import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { IDRegisterCheckout, IDRegisterItem, Payment as PaymentStruct, PaymentMethod,PaymentStatus, RegisterItem, RegisterResponse, Version, WaitingListType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { Group } from '../models/Group';
import { Member, RegistrationWithMember } from '../models/Member';
import { MolliePayment } from '../models/MolliePayment';
import { MollieToken } from '../models/MollieToken';
import { PayconiqPayment } from '../models/PayconiqPayment';
import { Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = IDRegisterCheckout
type ResponseBody = RegisterResponse

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

        const members = await Member.getMembersWithRegistrationForUser(user)
        const groups = await Group.where({ organizationId: user.organizationId })
        
        const registrations: RegistrationWithMember[] = []
        const payRegistrations: Registration[] = []
        const payNames: string[] = []

        let totalPrice = 0

        if (request.body.cart.items.length == 0) {
            throw new SimpleError({
                code: "empty_data",
                message: "Oeps, jouw mandje is leeg. Voeg eerst inschrijvingen toe voor je verder gaat."
            })
        }

        let alreadyRegisteredCount = 0
        for (const member of members) {
            if (member.registrations.find(r => {
                if (r.waitingList) {
                    return false
                }
                const group = groups.find(g => g.id == r.groupId)
                if (!group) {
                    return false
                }
                if (group.cycle == r.cycle) {
                    return true
                }
                return false
            })) {
                alreadyRegisteredCount++;
            }
        }

        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = "memberId"

        // Put registrations without a family price in front of the row, so we can improve price calculation
        const sortedItems: IDRegisterItem[] = []

        for (const item of request.body.cart.items) {
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
                    message: "De leeftijdsgroep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }
            if (group.settings.prices.find(p => p.familyPrice !== null)) {
                // append
                sortedItems.push(item)
            } else {
                // prepend
                sortedItems.unshift(item)
            }
        }

        mainLoop: for (const item of sortedItems) {
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
                    message: "De leeftijdsgroep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            const startDate = (group.settings.preRegistrationsDate ? group.settings.preRegistrationsDate : group.settings.registrationStartDate) ?? group.settings.registrationStartDate
            const endDate = group.settings.registrationEndDate
            const now = new Date()
            if (now < startDate) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "Oeps, je kan "+member.firstName+" nog niet inschrijven. Je moet wachten tot ten minste "+Formatter.dateTime(startDate)+"."
                })
            }

            if (now > endDate) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "Oeps, te laat! De inschrijvingen werden gesloten om "+Formatter.dateTime(startDate)+". Je kan "+member.firstName+" niet meer inschrijven."
                })
            }

            // 

            // Check if this member is already registered in this group?
            const existingRegistrations = await Registration.where({ memberId: member.id, groupId: item.groupId, cycle: group.cycle })
            let registration: RegistrationWithMember | undefined = undefined;

            for (const existingRegistration of existingRegistrations) {
                registration = existingRegistration.setRelation(registrationMemberRelation, member as Member)

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
                registration = new Registration().setRelation(registrationMemberRelation, member as Member)
            }

            registration.memberId = member.id
            registration.groupId = group.id
            registration.cycle = group.cycle

            if (item.waitingList) {
                registration.waitingList = true
                registration.reservedUntil = null
                await registration.save()
            } else {

                // Check maximum members, but ignore maximum membes if they received an invitation (canRegister) OR if it was reserved and still valid
                if (!(registration.waitingList && registration.canRegister) && group.settings.maxMembers !== null && (registration.reservedUntil === null || registration.reservedUntil < new Date())) {
                    await group.updateOccupancy()

                    if (group.settings.registeredMembers === null) {
                        console.error("Registered members is null after checking update occupancy for group", group.id)
                    }
                    if (group.settings.registeredMembers === null || group.settings.registeredMembers >= group.settings.maxMembers) {
                        throw new SimpleError({
                            code: "invalid_member",
                            message: "Oeps, de leeftijdsgroep "+group.settings.name+" is volzet terwijl je aan het inschrijven was!"
                        })
                    }
                }

                registration.waitingList = false
                registration.canRegister = false
                const foundPrice = group.settings.getGroupPrices(now)

                if (!foundPrice) {
                    throw new SimpleError({
                        code: "invalid_member",
                        message: "We konden geen passende prijs vinden voor deze inschrijving. Contacteer ons zodat we dit probleem kunnen recht zetten"
                    }) 
                }

                const price = foundPrice.getPriceFor(item.reduced, alreadyRegisteredCount)
                totalPrice += price
                payRegistrations.push(registration)
                payNames.push(member.firstName)
                alreadyRegisteredCount++;
            }
            registrations.push(registration)
        }

        // todo: validate payment method
        
        if (payRegistrations.length > 0) {
            const payment = new Payment()
            payment.userId = user.id
            payment.method = request.body.paymentMethod
            payment.status = PaymentStatus.Created
            payment.price = totalPrice

            if (payment.method == PaymentMethod.Transfer) {
                // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
                payment.transferDescription = Payment.generateDescription(user.organization.meta.transferSettings, payNames.join(", "))
            }
            payment.paidAt = null

            if (totalPrice == 0) {
                payment.status = PaymentStatus.Succeeded
                payment.paidAt = new Date()
            }

            await payment.save()

            // Save registrations and add extra data if needed
            for (const registration of payRegistrations) {
                if (!registration.waitingList) {
                    registration.paymentId = payment.id
                    registration.reservedUntil = null

                    if (payment.method == PaymentMethod.Transfer || payment.status == PaymentStatus.Succeeded) {
                        registration.registeredAt = new Date()
                    } else {
                        // Reserve registration for 30 minutes (if needed)
                        const group = groups.find(g => g.id === registration.groupId)

                        if (group && group.settings.maxMembers !== null) {
                            registration.reservedUntil = new Date(new Date().getTime() + 1000*60*30)
                        }
                    }
                }
                
                await registration.save()
            }

            // Update occupancy
            for (const group of groups) {
                if (payRegistrations.find(p => p.groupId === group.id)) {
                    await group.updateOccupancy()
                    await group.save()
                }
            }

            let paymentUrl: string | null = null
            const description = 'Inschrijving bij '+user.organization.name
            if (payment.status != PaymentStatus.Succeeded) {
                if (payment.method == PaymentMethod.Bancontact || payment.method == PaymentMethod.iDEAL) {
                    
                    // Mollie payment
                    const token = await MollieToken.getTokenFor(user.organizationId)
                    if (!token) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via "+(payment.method == PaymentMethod.Bancontact ? "Bancontact" : "iDEAL") +" is onbeschikbaar"
                        })
                    }
                    const profileId = await token.getProfileId()
                    if (!profileId) {
                        throw new SimpleError({
                            code: "",
                            message: "Betaling via "+(payment.method == PaymentMethod.Bancontact ? "Bancontact" : "iDEAL") +" is tijdelijk onbeschikbaar"
                        })
                    }
                    const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (totalPrice / 100).toFixed(2)
                        },
                        method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : molliePaymentMethod.ideal,
                        testmode: process.env.NODE_ENV != 'production',
                        profileId,
                        description,
                        redirectUrl: "https://"+user.organization.getHost()+'/payment?id='+encodeURIComponent(payment.id),
                        webhookUrl: 'https://'+user.organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
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
                } else if (payment.method == PaymentMethod.Payconiq) {
                    paymentUrl = await PayconiqPayment.createPayment(payment, user.organization, description)
                }
            }

            return new Response(RegisterResponse.create({
                payment: PaymentStruct.create(payment),
                members: (await Member.getMembersWithRegistrationForUser(user)).map(m => m.getStructureWithRegistrations()),
                registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r)),
                paymentUrl
            }));
        }
        
        return new Response(RegisterResponse.create({
            payment: null,
            members: (await Member.getMembersWithRegistrationForUser(user)).map(m => m.getStructureWithRegistrations()),
            registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r))
        }));
    }
}
