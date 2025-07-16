import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { EventMeta, Event as EventStruct, GroupType, TranslatedString } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { Group } from './Group';

export class Event extends QueryableModel {
    static table = 'events';

    @column({ primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: 'string' })
    name: string;

    @column({ type: 'string' })
    typeId: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    groupId: string | null = null;

    @column({ type: 'string', nullable: true })
    webshopId: string | null = null;

    @column({ type: 'datetime' })
    startDate: Date;

    @column({ type: 'datetime' })
    endDate: Date;

    @column({ type: 'json', decoder: EventMeta })
    meta = EventMeta.create({});

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    /**
     * @deprecated
     */
    getStructure(group?: Group | null) {
        return EventStruct.create({
            ...this,
            group: group ? group.getStructure() : null,
        });
    }

    /**
     * @deprecated
     */
    getPrivateStructure(group?: Group | null) {
        return EventStruct.create({
            ...this,
            group: group ? group.getPrivateStructure() : null,
        });
    }

    async syncGroupRequirements(group: Group | null) {
        if (!group) {
            return;
        }

        group.settings.requireDefaultAgeGroupIds = this.meta.defaultAgeGroupIds ?? [];
        group.settings.requireGroupIds = this.meta.groups?.map(g => g.id) ?? [];
        group.settings.startDate = this.startDate;
        group.settings.endDate = this.endDate;

        if (group.type === GroupType.EventRegistration) {
            // Don't change the name of the waiting list
            group.settings.name = new TranslatedString(this.name);
            group.settings.eventId = this.id;
        }

        if (this.organizationId) {
            // This is a not-national event, so require the organization
            group.settings.requireOrganizationIds = [this.organizationId];
            group.settings.requireOrganizationTags = [];
            group.settings.requirePlatformMembershipOn = null;
        }
        else {
            group.settings.requireOrganizationTags = this.meta.organizationTagIds ?? [];

            // Everyone can register
            group.settings.requireOrganizationIds = [];

            // But they need a valid platform membership
            group.settings.requirePlatformMembershipOn = this.endDate;
        }
        await group.save();

        if (group.waitingListId) {
            const waitingList = await Group.getByID(group.waitingListId);
            if (waitingList) {
                if (group.settings.allowRegistrationsByOrganization) {
                    waitingList.settings.allowRegistrationsByOrganization = true;
                }
                await this.syncGroupRequirements(waitingList);
            }
        }
    }
}
