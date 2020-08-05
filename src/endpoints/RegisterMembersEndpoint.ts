import { ManyToOneRelation,OneToManyRelation } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { GroupPrices, Payment as PaymentStruct, PaymentMethod,PaymentStatus, RegisterMembers, RegisterResponse } from "@stamhoofd/structures";

import { Group } from '../models/Group';
import { Member, RegistrationWithMember } from '../models/Member';
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

        const members = await user.getMembersWithRegistration()
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

        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = "memberId"

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

            const registration = new Registration().setRelation(registrationMemberRelation, member as Member)
            registration.memberId = member.id
            registration.groupId = group.id
            registration.cycle = group.cycle

            if (register.waitingList) {
                registration.waitingList = true
                await registration.save()
            } else {
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

                const price = register.reduced && foundPrice.reducedPrice !== null ? foundPrice.reducedPrice : foundPrice.price
                totalPrice += price
                payRegistrations.push(registration)
            }
            registrations.push(registration)
        }

        // todo: validate payment method
        
        if (payRegistrations.length > 0) {
            const payment = new Payment()
            payment.method = request.body.paymentMethod
            payment.status = PaymentStatus.Pending
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

                    if (payment.method == PaymentMethod.Transfer) {
                        registration.registeredAt = new Date()
                    }
                }
                
                await registration.save()
            }
            return new Response(RegisterResponse.create({
                payment: PaymentStruct.create(payment),
                members: (await user.getMembersWithRegistration()).map(m => m.getStructureWithRegistrations()),
                registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r))
            }));
        }
        
        return new Response(RegisterResponse.create({
            payment: null,
            members: (await user.getMembersWithRegistration()).map(m => m.getStructureWithRegistrations()),
            registrations: registrations.map(r => Member.getRegistrationWithMemberStructure(r))
        }));
    }
}
