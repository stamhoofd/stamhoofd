import { AutoEncoder, BooleanDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Group } from '../../Group';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../../Organization';
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

    /**
     * Unique identifier to check if two cart items are the same
     */
    get id(): string {
        return this.member.id+"."+this.group.id
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
            groupId: this.group.id
        }, this))
    }
}
