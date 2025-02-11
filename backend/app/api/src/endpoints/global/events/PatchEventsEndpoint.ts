import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Event, Group, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { AuditLogSource, Event as EventStruct, Group as GroupStruct, GroupType, NamedObject } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { AuditLogService } from '../../../services/AuditLogService';
import { PatchOrganizationRegistrationPeriodsEndpoint } from '../../organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint';

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
                    human: 'Kies minstens één leeftijdsgroep',
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: 'Kies minstens één standaard leeftijdsgroep',
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: 'Kies minstens één tag',
                });
            }

            const eventOrganization = await this.checkEventAccess(event);
            event.id = put.id;
            event.name = put.name;
            event.startDate = put.startDate;
            event.endDate = put.endDate;

            const type = await PatchEventsEndpoint.getEventType(put.typeId);
            event.typeId = type.id;
            event.meta.organizationCache = eventOrganization ? NamedObject.create({ id: eventOrganization.id, name: eventOrganization.name }) : null;
            await PatchEventsEndpoint.checkEventLimits(event);

            if (put.group) {
                const period = await RegistrationPeriod.getByDate(event.startDate);

                if (!period) {
                    throw new SimpleError({
                        code: 'invalid_period',
                        message: 'No period found for this start date',
                        human: Context.i18n.$t('5959a6a9-064a-413c-871f-c74a145ed569'),
                        field: 'startDate',
                    });
                }

                put.group.type = GroupType.EventRegistration;
                const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                    put.group,
                    put.group.organizationId,
                    period,
                );
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
                    human: 'De activiteit werd niet gevonden',
                });
            }

            await this.checkEventAccess(event);

            if (patch.meta?.organizationCache) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Cannot patch organizationCache',
                    human: 'Je kan de organizationCache niet aanpassen via een patch',
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
                    human: 'Kies minstens één leeftijdsgroep',
                });
            }

            if (event.meta.defaultAgeGroupIds && event.meta.defaultAgeGroupIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty default age groups',
                    human: 'Kies minstens één standaard leeftijdsgroep',
                });
            }

            if (event.meta.organizationTagIds && event.meta.organizationTagIds.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Empty organization tag ids',
                    human: 'Kies minstens één tag',
                });
            }

            const eventOrganization = await this.checkEventAccess(event);
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

                    const period = await RegistrationPeriod.getByDate(event.startDate);
                    await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(patch.group, period);
                }
                else {
                    if (event.groupId) {
                        // need to delete old group first
                        await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId);
                        event.groupId = null;
                    }
                    patch.group.type = GroupType.EventRegistration;

                    const period = await RegistrationPeriod.getByDate(event.startDate);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_period',
                            message: 'No period found for this start date',
                            human: Context.i18n.$t('5959a6a9-064a-413c-871f-c74a145ed569'),
                            field: 'startDate',
                        });
                    }

                    const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                        patch.group,
                        patch.group.organizationId,
                        period,
                    );
                    event.groupId = group.id;
                }
            }
            else {
                if (patch.startDate || patch.endDate) {
                    // Correct period id if needed
                    const period = await RegistrationPeriod.getByDate(event.startDate);
                    if (event.groupId) {
                        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                            if (event.groupId) {
                                await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(GroupStruct.patch({ id: event.groupId }), period);
                            }
                        });
                    }
                }
            }

            if (type.isLocationRequired === true) {
                PatchEventsEndpoint.throwIfAddressIsMissing(event);
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

            await this.checkEventAccess(event);

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
                human: 'Dit type activiteit wordt niet ondersteund',
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
                human: 'Vul een naam voor je activiteit in',
                field: 'name',
            });
        }

        if (event.endDate < event.startDate) {
            throw new SimpleError({
                code: 'invalid_dates',
                message: 'End date is before start date',
                human: 'De einddatum moet na de startdatum liggen',
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
                    human: 'Een ' + type.name + ' moet minimum ' + Formatter.pluralText(type.minimumDays, 'dag', 'dagen') + ' duren',
                    field: 'startDate',
                });
            }

            if (type.maximumDays !== null && days > type.maximumDays) {
                throw new SimpleError({
                    code: 'maximum_days',
                    message: 'An event with this type has a maximum of ' + type.maximumDays + ' days',
                    human: 'Een ' + type.name + ' mag maximaal ' + Formatter.pluralText(type.maximumDays, 'dag', 'dagen') + ' duren',
                    field: 'startDate',
                });
            }
        }

        if (type.maximum && (!event.existsInDatabase || ('typeId' in (await event.getChangedDatabaseProperties()).fields))) {
            const currentPeriod = await RegistrationPeriod.getByDate(event.startDate);
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
                        human: 'Het maximum aantal voor ' + type.name + ' is bereikt (' + type.maximum + ')',
                        field: 'typeId',
                    });
                }
            }
            else {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'No period found for this start date',
                    human: 'Oeps, je kan nog geen evenementen van dit type aanmaken in deze periode',
                    field: 'startDate',
                });
            }
        }
    }

    private async checkEventAccess(event: Event) {
        return await Context.auth.checkEventAccess(event);
    }

    private static throwIfAddressIsMissing(event: Event) {
        const address = event.meta.location?.address;

        if (!address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Empty number',
                human: 'De locatie is verplicht voor deze soort activiteit.',
                field: 'event_required',
            });
        }

        address.throwIfIncomplete();
    }
}
