import { AutoEncoder, BooleanDecoder,DateDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { Payment } from './Payment';

export class Registration extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4()  })
    id: string

    /// You need to look up the group yourself in the organization
    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: IntegerDecoder })
    cycle: number

    /// Set registeredAt to null if the member is on the waiting list for now
    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null

    /// Keep spot for this member temporarily
    @field({ decoder: DateDecoder, nullable: true })
    reservedUntil: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    deactivatedAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()

    @field({ decoder: BooleanDecoder, version: 16 })
    waitingList = false

    @field({ decoder: BooleanDecoder, version: 20 })
    canRegister = false

    /// Payment can be null if the member is on a waiting list
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null

    /**
     * Return an unique ID that is the same for all groups that should have equal family pricing (2nd, 3rd discount)
     */
    getFamilyDiscountId(groups: Group[], all: GroupCategory[]) {
        const group = groups.find(g => g.id === this.groupId)
        if (!group) {
            // Default to group pricing
            return this.groupId
        }
        const parents = group.getParentCategories(all, false)
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations === 1) {
                return "category-"+parent.id
            }
        }

        // Only registrations in same group are elegiable for family discount
        return "group-"+this.groupId
    }
}