import { createMollieClient, PaymentMethod as molliePaymentMethod } from '@mollie/api-client';
import { ManyToOneRelation,OneToManyRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { GroupPrices, Payment as PaymentStruct, PaymentMethod,PaymentStatus, RegisterMember,RegisterMembers, RegisterResponse, Version } from "@stamhoofd/structures";

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
type Body = RegisterMembers
type ResponseBody = RegisterResponse

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class RegisterMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = RegisterMembers as Decoder<RegisterMembers>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user/members/register", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        const members = await Member.getMembersWithRegistrationForUser(user)
        const groups = await Group.where({ organizationId: user.organizationId })
        
        const registrations: RegistrationWithMember[] = []
        const payRegistrations: Registration[] = []
        
        const now = new Date()
        let totalPrice = 0

        if (request.body.members.length == 0) {
            throw new SimpleError({
                code: "empty_data",
                message: "Oeps, je hebt niemand geselecteerd om in te schrijven"
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

        // Put groups without a family price in front of the row, so we can improve price calculation
        const sortedMembers: RegisterMember[] = []

        for (const register of request.body.members) {
            const member = members.find(m => m.id == register.memberId)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "Het lid dat je probeert in te schrijven konden we niet meer terugvinden. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            const group = groups.find(g => g.id == register.groupId);
            if (!group) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "De leeftijdsgroep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }
            if (group.settings.prices.find(p => p.familyPrice !== null)) {
                // append
                sortedMembers.push(register)
            } else {
                // prepend
                sortedMembers.unshift(register)
            }
        }

        mainLoop: for (const register of sortedMembers) {
            const member = members.find(m => m.id == register.memberId)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "Het lid dat je probeert in te schrijven konden we niet meer terugvinden. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            const group = groups.find(g => g.id == register.groupId);
            if (!group) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "De leeftijdsgroep waarin je een lid probeert in te schrijven lijkt niet meer te bestaan. Je herlaadt best even de pagina om opnieuw te proberen."
                })
            }

            // Check if this member is already registered in this group?
            const existingRegistrations = await Registration.where({ memberId: member.id, groupId: register.groupId, cycle: group.cycle })
            let registration: RegistrationWithMember | undefined = undefined;

            for (const existingRegistration of existingRegistrations) {
                registration = existingRegistration.setRelation(registrationMemberRelation, member as Member)

                if (existingRegistration.waitingList && register.waitingList) {
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

            if (register.waitingList) {
                registration.waitingList = true
                await registration.save()
            } else {
                registration.waitingList = false
                registration.canRegister = false
                let foundPrice: GroupPrices | undefined = undefined

                // Determine price
                for (const price of group.settings.prices) {
                    if (!price.startDate || price.startDate <= now) {
                        foundPrice = price
                    }
                }

                if (!foundPrice) {
                    throw new SimpleError({
                        code: "invalid_member",
                        message: "We konden geen passende prijs vinden voor deze inschrijving. Contacteer ons zodat we dit probleem kunnen recht zetten"
                    }) 
                }

                let price = register.reduced && foundPrice.reducedPrice !== null ? foundPrice.reducedPrice : foundPrice.price
                if (foundPrice.familyPrice && alreadyRegisteredCount == 1 && foundPrice.familyPrice < price) {
                    price = foundPrice.familyPrice
                }
                if (foundPrice.extraFamilyPrice && alreadyRegisteredCount >= 2 && foundPrice.extraFamilyPrice < price) {
                    price = foundPrice.extraFamilyPrice
                }
                totalPrice += price
                payRegistrations.push(registration)
                alreadyRegisteredCount++;
            }
            registrations.push(registration)
        }

        // todo: validate payment method
        
        if (payRegistrations.length > 0) {
            const payment = new Payment()
            payment.method = request.body.paymentMethod
            payment.status = PaymentStatus.Created
            payment.price = totalPrice
            payment.transferDescription = payment.method == PaymentMethod.Transfer ? Payment.generateOGM() : null
            payment.paidAt = null

            if (totalPrice == 0) {
                payment.status = PaymentStatus.Succeeded
                payment.paidAt = new Date()
            }

            await payment.save()

            for (const registration of payRegistrations) {
                if (!registration.waitingList) {
                    registration.paymentId = payment.id

                    if (payment.method == PaymentMethod.Transfer || payment.status == PaymentStatus.Succeeded) {
                        registration.registeredAt = new Date()
                    }
                }
                
                await registration.save()
            }

            let paymentUrl: string | null = null
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
                        description: 'Inschrijving bij '+user.organization.name,
                        redirectUrl: "https://"+user.organization.getHost()+'/payment?id='+encodeURIComponent(payment.id),
                        webhookUrl: 'https://'+user.organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
                        metadata: {
                            paymentId: payment.id,
                        },
                    });
                    console.log(molliePayment)
                    paymentUrl = molliePayment.getCheckoutUrl()

                    // Save payment
                    const dbPayment = new MolliePayment()
                    dbPayment.paymentId = payment.id
                    dbPayment.mollieId = molliePayment.id
                    await dbPayment.save();
                } else if (payment.method == PaymentMethod.Payconiq) {
                    paymentUrl = await PayconiqPayment.createPayment(payment, user.organization)
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
