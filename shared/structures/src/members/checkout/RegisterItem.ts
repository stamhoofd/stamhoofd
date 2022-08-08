import { AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Group } from '../../Group';
import { GroupCategory } from '../../GroupCategory';
import { Organization } from '../../Organization';
import { MemberWithRegistrations } from '../MemberWithRegistrations';
import { RegisterCartValidator } from './RegisterCartValidator';
import { UnknownMemberWithRegistrations } from './UnknownMemberWithRegistrations';

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

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], previousItems: (IDRegisterItem | RegisterItem)[]) {
        RegisterCartValidator.validateItem(this, family, groups, categories, previousItems)
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

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], previousItems: (IDRegisterItem | RegisterItem)[]) {
        RegisterCartValidator.validateItem(this, family, groups, categories, previousItems)
    }
}
