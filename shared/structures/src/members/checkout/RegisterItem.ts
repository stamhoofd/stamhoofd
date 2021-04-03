import { AutoEncoder, BooleanDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Group } from '../../Group';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GroupCategory } from '../../GroupCategory';
import { GroupPrices } from '../../GroupPrices';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../../Organization';
import { EncryptedMemberWithRegistrations } from '../EncryptedMemberWithRegistrations';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from '../MemberWithRegistrations';

/**
 * Version destined for the server and client side storage
 */
export class IDRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    memberId: string

    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: BooleanDecoder })
    reduced: boolean

    @field({ decoder: BooleanDecoder})
    waitingList = false

    /**
     * Will get validated. Is used to check if the price has changed between frontend and backend
     */
    @field({ decoder: IntegerDecoder})
    calculatedPrice = 0

    convert(organization: Organization, members: MemberWithRegistrations[]): RegisterItem | null {
        const group = organization.groups.find(g => g.id === this.groupId)
        if (!group) {
            return null
        }
        const member = members.find(g => g.id === this.memberId)
        if (!member) {
            return null
        }
        return new RegisterItem(member, group, this)
    }
}

/**
 * Used in memory in the client
 * Do not extend IDRegisterItem to prevent leaking information when encoding a RegisterItem as IDRegisterItem.
 * This version is not encodeable
 */
export class RegisterItem {
    member: MemberWithRegistrations
    group: Group
    reduced = false
    waitingList = false
    calculatedPrice = 0

    /**
     * Unique identifier to check if two cart items are the same
     */
    get id(): string {
        return this.member.id+"."+this.group.id
    }

    get groupId(): string {
        return this.group.id
    }

    get memberId(): string {
        return this.member.id
    }

    constructor(member: MemberWithRegistrations, group: Group, settings: {
        reduced: boolean
        waitingList: boolean
    }) {
        this.member = member
        this.group = group
        this.reduced = settings.reduced
        this.waitingList = settings.waitingList
    }

    convert(): IDRegisterItem {
        return IDRegisterItem.create(Object.assign({
            memberId: this.member.id,
            groupId: this.group.id,
            calculatedPrice: this.calculatedPrice
        }, this))
    }

    validate(family: MemberWithRegistrations[], all: GroupCategory[], previousItems: (IDRegisterItem | RegisterItem)[]) {
        const canRegister = this.member.canRegister(this.group, family, all, previousItems)
        if (canRegister.closed) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Registration not possible anymore",
                human: "Je kan "+this.member.firstName+" niet meer inschrijven voor "+this.group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : '')
            })
        }

        if (!this.waitingList && canRegister.waitingList) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Registration not possible anymore",
                human: "Je kan "+this.member.firstName+" enkel nog inschrijven voor de wachtlijst van "+this.group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : '')
            })
        }

        // Check maximum
        if (this.group.settings.maxMembers !== null) {
            const count = previousItems.filter(item => item.groupId === this.groupId).length
            if (count >= this.group.settings.maxMembers - (this.group.settings.registeredMembers ?? 0)) {
                throw new SimpleError({
                    code: "invalid_registration",
                    message: "Reached maximum members allowed",
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    human: "Er zijn nog maar " + (this.group.settings.maxMembers - (this.group.settings.registeredMembers ?? 0)) + " plaatsen meer vrij voor "+this.group.settings.name+". Je kan "+this.member.firstName+" niet meer inschrijven."+(this.group.settings.waitingListIfFull ? " Je kan wel op de wachtlijst inschrijven." : "")
                })
            }
        }
        
    }
}
