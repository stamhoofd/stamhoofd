import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Event, Group, Platform, RegistrationPeriod, Webshop } from '@stamhoofd/models';
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
                human: Context.i18n.$t('5959a6a9-064a-413c-871f-c74a145ed569'),
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
            throw Context.auth.error($t(`0d47541d-abf2-45b5-a06c-3a85b7fa3994`));
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
                    human: $t(`93faf169-b78d-4ad2-b13b-3b974267a632`),
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: $t(`2712befc-5cc5-4013-b8df-ec0861a82c36`),
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: $t(`30230574-2956-4e40-ba11-5523c24c0af8`),
                });
            }

            const eventOrganization = await Context.auth.checkEventAccess(event);
            event.id = put.id;
            event.name = put.name;
            event.startDate = put.startDate;
            event.endDate = put.endDate;

            const type = await PatchEventsEndpoint.getEventType(put.typeId);
            event.typeId = type.id;
            event.meta.organizationCache = eventOrganization ? NamedObject.create({ id: eventOrganization.id, name: eventOrganization.name }) : null;
            await PatchEventsEndpoint.checkEventLimits(event);

            if (put.group) {
                const group = await this.putEventGroup(event, put.group);
                await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                    await event.syncGroupRequirements(group);
                });
                event.groupId = group.id;
            }

            if (type.isLocationRequired === true) {
                PatchEventsEndpoint.throwIfAddressIsMissing(event);
            }

            await event.save();

            events.push(event);
        }

        const patchingEvents = await Event.getByIDs(...request.body.getPatches().map(p => p.id));

        for (const patch of request.body.getPatches()) {
            const event = patchingEvents.find(e => e.id === patch.id);

            if (!event) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Event not found',
                    human: $t(`c5f3d2c3-9d7a-473d-ba91-63ce104a2de5`),
                });
            }

            await Context.auth.checkEventAccess(event);

            if (patch.meta?.organizationCache) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Cannot patch organizationCache',
                    human: $t(`74e6eba6-596c-4e55-b178-b2a5fdbca581`),
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
                    human: $t(`93faf169-b78d-4ad2-b13b-3b974267a632`),
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: $t(`2712befc-5cc5-4013-b8df-ec0861a82c36`),
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: $t(`30230574-2956-4e40-ba11-5523c24c0af8`),
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

            const type = await PatchEventsEndpoint.getEventType(patch.typeId ?? event.typeId);

            if (patch.typeId) {
                event.typeId = type.id;
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
                                human: $t('1f64237b-84c4-43e7-b752-2875fd1eb075'),
                            });
                        }
                    }
                }
            }

            if (type.isLocationRequired === true) {
                PatchEventsEndpoint.throwIfAddressIsMissing(event);
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
                            human: $t(`c5f3d2c3-9d7a-473d-ba91-63ce104a2de5`),
                            field: 'webshopId',
                        });
                    }
                    if (!await Context.auth.canAccessWebshop(webshop, PermissionLevel.Read)) {
                        throw Context.auth.error($t('2ee1d364-8747-430d-8a33-094e01df465e'));
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
                human: $t(`6b36fc82-d88c-49cc-ae94-4653ad37b3e3`),
                field: 'typeId',
            });
        }
        return type;
    }

    static async checkEventLimits(event: Event) {
        const type = await this.getEventType(event.typeId);

        if (event.name.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Name is too short',
                human: $t(`53a66432-0bf5-4193-9eb8-dbd52d86a1f8`),
                field: 'name',
            });
        }

        if (event.endDate < event.startDate) {
            throw new SimpleError({
                code: 'invalid_dates',
                message: 'End date is before start date',
                human: $t(`318924c0-7a79-4cfa-b206-ffc27c4d32b7`),
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
                    human: $t(`04ff85c0-eb98-46b8-975b-8fd136ddc49a`, {
                        name: type.name,
                        days: Formatter.pluralText(type.minimumDays, $t(`a6279389-a070-49c9-a085-bb312555e419`), $t(`fca0ce20-d696-4966-a50c-441f54f046c4`)),
                    }),
                    field: 'startDate',
                });
            }

            if (type.maximumDays !== null && days > type.maximumDays) {
                throw new SimpleError({
                    code: 'maximum_days',
                    message: 'An event with this type has a maximum of ' + type.maximumDays + ' days',
                    human: $t(`a7d005aa-ceaa-4323-8fac-a02fce174023`, {
                        name: type.name,
                        days: Formatter.pluralText(type.maximumDays, $t(`a6279389-a070-49c9-a085-bb312555e419`), $t(`fca0ce20-d696-4966-a50c-441f54f046c4`)),
                    }),
                    field: 'startDate',
                });
            }
        }

        if (type.maximum && (!event.existsInDatabase || ('typeId' in (await event.getChangedDatabaseProperties()).fields))) {
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
                        human: $t(`fb7df531-0f89-4841-b685-7b2cfb5b507d`) + ' ' + type.name + ' ' + $t(`073d20dc-88f3-4145-89f5-13cc8ad90207`) + type.maximum + ')',
                        field: 'typeId',
                    });
                }
            }
            else {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'No period found for this start date',
                    human: $t(`7a38bf9d-4df7-4827-85dc-327ffe6cd50a`),
                    field: 'startDate',
                });
            }
        }
    }

    private static throwIfAddressIsMissing(event: Event) {
        const address = event.meta.location?.address;

        if (!address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty number',
                human: $t(`6b72f8bd-cd5b-423f-a556-be102d3c22e9`),
                field: 'event_required',
            });
        }

        address.throwIfIncomplete();
    }
}
