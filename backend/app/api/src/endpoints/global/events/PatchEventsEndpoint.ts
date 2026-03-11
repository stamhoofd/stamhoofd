import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Event, Group, OrganizationRegistrationPeriod, Platform, RegistrationPeriod, Webshop } from '@stamhoofd/models';
import { AuditLogSource, Event as EventStruct, Group as GroupStruct, GroupType, NamedObject, PermissionLevel } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { AuditLogService } from '../../../services/AuditLogService.js';
import { PatchOrganizationRegistrationPeriodsEndpoint } from '../../organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<EventStruct>;
type ResponseBody = EventStruct[];

export class PatchEventsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EventStruct as Decoder<EventStruct>, EventStruct.patchType() as Decoder<AutoEncoderPatchType<EventStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/events', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async putEventGroup(event: Event, putGroup: GroupStruct) {
        const period = await RegistrationPeriod.getByDate(event.startDate, event.organizationId);

        if (!period) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'No period found for this start date: ' + Formatter.dateIso(event.startDate),
                human: Context.i18n.$t('%8F'),
                field: 'startDate',
            });
        }

        let group = await Group.getByID(putGroup.id);
        const groupOrganizationId = group?.organizationId ?? putGroup.organizationId;

        if (event.organizationId && groupOrganizationId !== event.organizationId) {
            // Silently ignore organizationId if it is invalid
            putGroup.organizationId = event.organizationId;
        }

        if (!await Context.auth.canAccessGroupsInPeriod(period.id, putGroup.organizationId)) {
            throw Context.auth.error($t(`%1HQ`));
        }

        if (!group) {
            putGroup.type = GroupType.EventRegistration;

            group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                putGroup,
                putGroup.organizationId,
                period,
                { allowedIds: [putGroup.id] },
            );
        }
        else {
            if (group.type !== GroupType.EventRegistration) {
                throw new SimpleError({
                    code: 'invalid_group',
                    message: 'Group is not of type EventRegistration',
                });
            }
        }

        return group;
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error();
            }
        }

        const events: Event[] = [];

        for (const { put } of request.body.getPuts()) {
            const event = new Event();
            event.organizationId = put.organizationId;
            event.meta = put.meta;

            if (event.organizationId === null && event.meta.groups !== null) {
                event.meta.groups = null;
                console.error('Removed groups because organizationId is null for new event');
            }

            if (event.meta.groups && event.meta.groups.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty groups',
                    human: $t(`%DV`),
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: $t(`%DW`),
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: $t(`%DX`),
                });
            }

            const eventOrganization = await Context.auth.checkEventAccess(event);
            event.id = put.id;
            event.name = put.name;
            event.startDate = put.startDate;
            event.endDate = put.endDate;
            event.typeId = put.typeId;

            event.meta.organizationCache = eventOrganization ? NamedObject.create({ id: eventOrganization.id, name: eventOrganization.name }) : null;
            await PatchEventsEndpoint.checkEventLimits(event);

            if (put.group) {
                await this.saveEventAndLinkExistingGroup(event, put.group);
            }
            else {
                await event.save();
            }

            events.push(event);
        }

        const patchingEvents = await Event.getByIDs(...request.body.getPatches().map(p => p.id));

        for (const patch of request.body.getPatches()) {
            const event = patchingEvents.find(e => e.id === patch.id);

            if (!event) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Event not found',
                    human: $t(`%DY`),
                });
            }

            await Context.auth.checkEventAccess(event);

            if (patch.meta?.organizationCache) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Cannot patch organizationCache',
                    human: $t(`%DZ`),
                    field: 'meta.organizationCache',
                });
            }

            event.meta = patchObject(event.meta, patch.meta);

            if (patch.organizationId !== undefined) {
                event.organizationId = patch.organizationId;
            }

            if (event.organizationId === null && event.meta.groups !== null) {
                event.meta.groups = null;
                console.error('Removed groups because organizationId is null for event', event.id);
            }

            if (event.meta.groups && event.meta.groups.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty groups',
                    human: $t(`%DV`),
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: $t(`%DW`),
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: $t(`%DX`),
                });
            }

            const eventOrganization = await Context.auth.checkEventAccess(event);
            if (eventOrganization) {
                event.meta.organizationCache = NamedObject.create({ id: eventOrganization.id, name: eventOrganization.name });
            }
            else {
                event.meta.organizationCache = null;
            }

            event.name = patch.name ?? event.name;
            event.startDate = patch.startDate ?? event.startDate;
            event.endDate = patch.endDate ?? event.endDate;

            if (patch.typeId) {
                event.typeId = patch.typeId;
            }

            await PatchEventsEndpoint.checkEventLimits(event);

            let group: Group | null = null;

            if (patch.group !== undefined) {
                if (patch.group === null) {
                    // delete
                    if (event.groupId) {
                        await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId);
                        event.groupId = null;
                    }
                }
                else if (patch.group.isPatch()) {
                    if (!event.groupId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'group',
                            message: 'Cannot patch group before it is created',
                        });
                    }
                    patch.group.id = event.groupId;
                    patch.group.type = GroupType.EventRegistration;

                    const period = await RegistrationPeriod.getByDate(event.startDate, event.organizationId);
                    group = await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(patch.group, period, { isPatchingEvent: true });
                }
                else {
                    if (event.groupId === patch.group.id) {
                        // ignore: bad practice: puts are not allowed like this
                        // risk of deleting data
                    }
                    else {
                        if (event.groupId) {
                            // need to delete old group first
                            await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId);
                            event.groupId = null;
                        }
                        group = await this.putEventGroup(event, patch.group);
                        event.groupId = group.id;
                    }
                }
            }
            else {
                if (patch.startDate || patch.endDate) {
                    // Correct period id if needed
                    const period = await RegistrationPeriod.getByDate(event.startDate, event.organizationId);
                    if (event.groupId && period) {
                        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                            if (event.groupId) {
                                group = await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(
                                    GroupStruct.patch({
                                        id: event.groupId,
                                        periodId: period.id,
                                    }),
                                    period,
                                    { isPatchingEvent: true },
                                );
                            }
                        });
                    }
                }
            }

            if (group || patch.organizationId !== undefined) {
                if (event.organizationId === null) {
                    // No validation required
                }
                else {
                    // Validate organizationId of group
                    if (event.groupId) {
                        group = group ?? (await Group.getByID(event.groupId) ?? null);

                        if (group && group.organizationId !== event.organizationId) {
                            throw new SimpleError({
                                code: 'invalid_group',
                                message: 'Group is not of the same organization',
                                human: $t('%15c'),
                            });
                        }
                    }
                }
            }

            if (patch.webshopId !== undefined) {
                if (patch.webshopId === null) {
                    event.webshopId = null;
                }
                else {
                    const webshop = await Webshop.getByID(patch.webshopId);
                    if (!webshop || (event.organizationId && webshop.organizationId !== event.organizationId)) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Webshop not found',
                            human: $t(`%DY`),
                            field: 'webshopId',
                        });
                    }
                    if (!await Context.auth.canAccessWebshop(webshop, PermissionLevel.Read)) {
                        throw Context.auth.error($t('%185'));
                    }
                    event.webshopId = webshop.id;
                }
            }

            await event.save();

            if (event.groupId) {
                const group = await Group.getByID(event.groupId);
                if (group) {
                    await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                        await event.syncGroupRequirements(group);
                    });
                }
            }

            events.push(event);
        }

        for (const id of request.body.getDeletes()) {
            const event = await Event.getByID(id);
            if (!event) {
                throw new SimpleError({ code: 'not_found', message: 'Event not found', statusCode: 404 });
            }

            await Context.auth.checkEventAccess(event);

            if (event.groupId) {
                await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId);
                event.groupId = null;
            }

            await event.delete();
        }

        const structures = await AuthenticatedStructures.events(events);
        return new Response(
            structures,
        );
    }

    static async validateEventType(typeId: string) {
        return (await this.getEventType(typeId)).id;
    }

    static async getEventType(typeId: string) {
        const platform = await Platform.getSharedStruct();
        const type = platform.config.eventTypes.find(t => t.id == typeId);
        if (!type) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid typeId',
                human: $t(`%Da`),
                field: 'typeId',
            });
        }
        return type;
    }

    static async checkEventLimits(event: Event) {
        const type = await this.getEventType(event.typeId);

        if (type.isLocationRequired) {
            const address = event.meta.location?.address;

            if (!address) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty number',
                    human: $t(`%vQ`),
                    field: 'event_required',
                });
            }

            address.throwIfIncomplete();
        }

        if (event.name.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Name is too short',
                human: $t(`%Db`),
                field: 'name',
            });
        }

        if (event.endDate < event.startDate) {
            throw new SimpleError({
                code: 'invalid_dates',
                message: 'End date is before start date',
                human: $t(`%Dc`),
                field: 'endDate',
            });
        }

        if (type.maximumDays !== null || type.minimumDays !== null) {
            const start = Formatter.luxon(event.startDate).startOf('day');
            const end = Formatter.luxon(event.endDate).startOf('day');

            const days = end.diff(start, 'days').days + 1;

            console.log('Detected days:', days);

            if (type.minimumDays !== null && days < type.minimumDays) {
                throw new SimpleError({
                    code: 'minimum_days',
                    message: 'An event with this type has a minimum of ' + type.minimumDays + ' days',
                    human: $t(`%14D`, {
                        name: type.name,
                        days: Formatter.pluralText(type.minimumDays, $t(`%1N7`), $t(`%1N6`)),
                    }),
                    field: 'startDate',
                });
            }

            if (type.maximumDays !== null && days > type.maximumDays) {
                throw new SimpleError({
                    code: 'maximum_days',
                    message: 'An event with this type has a maximum of ' + type.maximumDays + ' days',
                    human: $t(`%14E`, {
                        name: type.name,
                        days: Formatter.pluralText(type.maximumDays, $t(`%1N7`), $t(`%1N6`)),
                    }),
                    field: 'startDate',
                });
            }
        }

        if (type.maximum && (!event.existsInDatabase || ('typeId' in (event.getChangedDatabaseProperties()).fields))) {
            const currentPeriod = await RegistrationPeriod.getByDate(event.startDate, event.organizationId);
            console.log('event.startDate', event.startDate);
            if (currentPeriod) {
                const count = await SQL.select().from(
                    SQL.table(Event.table),
                )
                    .where(SQL.column('organizationId'), event.organizationId)
                    .where(SQL.column('typeId'), event.typeId)
                    .where(SQL.column('id'), SQLWhereSign.NotEqual, event.id)
                    .where(SQL.column('startDate'), SQLWhereSign.GreaterEqual, currentPeriod.startDate)
                    .where(SQL.column('endDate'), SQLWhereSign.LessEqual, currentPeriod.endDate)
                    .count();

                if (count >= type.maximum) {
                    throw new SimpleError({
                        code: 'type_maximum_reached',
                        message: 'Maximum number of events with this type reached',
                        human: $t(`%Dd`) + ' ' + type.name + ' ' + $t(`%De`) + type.maximum + ')',
                        field: 'typeId',
                    });
                }
            }
            else {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'No period found for this start date',
                    human: $t(`%Df`),
                    field: 'startDate',
                });
            }
        }
    }

    private async saveEventAndLinkExistingGroup(event: Event, putGroup: GroupStruct): Promise<void> {
        const existingGroup = await Group.getByID(putGroup.id);

        if (!existingGroup) {
            throw new SimpleError({
                code: 'group_not_found',
                message: `Group with id ${putGroup.id} does not exist`,
            });
        }

        // keep track of original data for reset in case of failure
        const originalGroupType = existingGroup.type;

        if (!await Context.auth.canAccessGroup(existingGroup)) {
            throw Context.auth.error($t(`%1N9`));
        }

        if (event.organizationId !== existingGroup.organizationId) {
            throw new SimpleError({
                code: 'invalid_group',
                message: 'Group has different organization id',
            });
        }

        if (existingGroup.settings.eventId !== null && existingGroup.settings.eventId !== event.id) {
            throw new SimpleError({
                code: 'invalid_group',
                message: 'Group is already linked to another event',
            });
        }

        if (existingGroup.type !== GroupType.EventRegistration) {
            if (existingGroup.type !== GroupType.Membership) {
                throw new SimpleError({
                    code: 'invalid_group',
                    message: 'Can only link a group of type EventRegistration or Membership',
                });
            }
            existingGroup.type = GroupType.EventRegistration;
        }

        existingGroup.settings.eventId = event.id;

        // update group categories
        const period = await RegistrationPeriod.getByID(existingGroup.periodId);
        if (!period) {
            throw new SimpleError({
                code: 'not_found',
                message: 'No period found for group',
            });
        }

        const organizationPeriod = await OrganizationRegistrationPeriod.select().where('organizationId', existingGroup.organizationId).where('periodId', period.id).first(true);
        if (!organizationPeriod) {
            throw new SimpleError({
                code: 'not_found',
                message: 'No organization period found for group',
            });
        }
        event.groupId = existingGroup.id;
        await event.save();

        try {
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                await event.syncGroupRequirements(existingGroup);
            });
        }
        catch (e) {
            // reset the group
            existingGroup.type = originalGroupType;
            existingGroup.settings.eventId = null;
            await existingGroup.save();

            // delete the event again if failed to link the group
            await event.delete();
            throw e;
        }

        const allGroups = await Group.getAll(organizationPeriod.organizationId, organizationPeriod.periodId);
        await organizationPeriod.cleanCategories(allGroups);
    }
}
