import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Event, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { Event as EventStruct, GroupType, PermissionLevel } from "@stamhoofd/structures";

import { SimpleError } from '@simonbackx/simple-errors';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { PatchOrganizationRegistrationPeriodsEndpoint } from '../../organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint';

type Params = { id: string };
type Query = undefined;
type Body = PatchableArrayAutoEncoder<EventStruct>
type ResponseBody = EventStruct[]

export class PatchEventsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EventStruct as Decoder<EventStruct>, EventStruct.patchType() as Decoder<AutoEncoderPatchType<EventStruct>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/events", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate()

        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error()
            }
        } else {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error()
            }
        }

        const events: Event[] = [];

        for (const {put} of request.body.getPuts()) {
            if (put.organizationId && organization?.id && put.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Invalid organizationId',
                    human: 'Je kan geen activiteiten aanmaken voor een andere organisatie',
                })
            }

            if (put.organizationId && !organization?.id && !Context.auth.hasPlatformFullAccess()) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Invalid organizationId',
                    human: 'Je kan geen activiteiten voor een specifieke organisatie aanmaken als je geen platform hoofdbeheerder bent',
                })
            }

            const event = new Event()
            event.id = put.id
            event.organizationId = organization?.id ?? null
            event.name = put.name
            event.startDate = put.startDate
            event.endDate = put.endDate
            event.meta = put.meta

            if (put.group) {
                put.group.type = GroupType.EventRegistration
                const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                    put.group,
                    organization?.id ?? put.group.organizationId,
                    organization?.periodId ? organization.periodId : put.group.periodId
                )
                event.groupId = group.id

            }
            event.typeId = await PatchEventsEndpoint.validateEventType(put.typeId)
            await PatchEventsEndpoint.checkEventLimits(event)

            if (!(await Context.auth.canAccessEvent(event, PermissionLevel.Full))) {
                throw Context.auth.error()
            }

            await event.save()

            events.push(event)
        }

        for (const patch of request.body.getPatches()) {
            const event = await Event.getByID(patch.id)

            if (!event || !(await Context.auth.canAccessEvent(event, PermissionLevel.Full))) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Event not found',
                    human: 'De activiteit werd niet gevonden',
                })
            }

            event.name = patch.name ?? event.name
            event.startDate = patch.startDate ?? event.startDate
            event.endDate = patch.endDate ?? event.endDate
            event.meta = patchObject(event.meta, patch.meta)
            event.typeId = patch.typeId ? (await PatchEventsEndpoint.validateEventType(patch.typeId)) : event.typeId
            await PatchEventsEndpoint.checkEventLimits(event)

            if (patch.group !== undefined) {
                if (patch.group === null) {
                    // delete
                    if (event.groupId) {
                        await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId)
                        event.groupId = null;
                    }

                } else if (patch.group.isPatch()) {
                    if (!event.groupId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'group',
                            message: 'Cannot patch group before it is created'
                        })
                    }
                    patch.group.id = event.groupId
                    patch.group.type = GroupType.EventRegistration
                    await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(patch.group)
                } else {
                    if (event.groupId) {
                        // need to delete old group first
                        await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(event.groupId)
                        event.groupId = null;
                    }
                    patch.group.type = GroupType.EventRegistration
                    const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                        patch.group,
                        organization?.id ?? patch.group.organizationId,
                        organization?.periodId ? organization.periodId : patch.group.periodId
                    )
                    event.groupId = group.id
                }
            }

            await event.save()
            events.push(event)
        }

        return new Response(
            await AuthenticatedStructures.events(events)
        );
    }

    static async validateEventType(typeId: string) {
        return (await this.getEventType(typeId)).id 
    }

    static async getEventType(typeId: string) {
        const platform = await Platform.getSharedStruct();
        const type = platform.config.eventTypes.find(t => t.id == typeId)
        if (!type) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid typeId',
                human: 'Dit type activiteit wordt niet ondersteund',
                field: 'typeId'
            })
        }
        return type
    }

    static async checkEventLimits(event: Event) {
        const type = await this.getEventType(event.typeId)

        if (event.name.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Name is too short',
                human: 'Vul een naam voor je activiteit in',
                field: 'name'
            })
        }

        if (event.endDate < event.startDate) {
            throw new SimpleError({
                code: 'invalid_dates',
                message: 'End date is before start date',
                human: 'De einddatum moet na de startdatum liggen',
                field: 'endDate'
            })
        }

        if (type.maximumDays !== null || type.minimumDays !== null) {
            const start = Formatter.luxon(event.startDate).startOf('day')
            const end = Formatter.luxon(event.endDate).startOf('day')

            const days = end.diff(start, 'days').days + 1;

            console.log('Detected days:', days)

            if (type.minimumDays !== null && days < type.minimumDays) {
                throw new SimpleError({
                    code: 'minimum_days',
                    message: 'An event with this type has a minimum of ' + type.minimumDays + ' days',
                    human: 'Een ' + type.name + ' moet minimum ' + Formatter.pluralText(type.minimumDays, 'dag', 'dagen') + ' duren',
                    field: 'startDate'
                })
            }

            if (type.maximumDays !== null && days > type.maximumDays) {
                throw new SimpleError({
                    code: 'maximum_days',
                    message: 'An event with this type has a maximum of ' + type.maximumDays + ' days',
                    human: 'Een ' + type.name + ' mag maximaal ' + Formatter.pluralText(type.maximumDays, 'dag', 'dagen') + ' duren',
                    field: 'startDate'
                })
            }
        }

        if (type.maximum && (!event.existsInDatabase || ("typeId" in (await event.getChangedDatabaseProperties()).fields))) {
            const currentPeriod = await RegistrationPeriod.getByDate(event.startDate);
            console.log('event.startDate', event.startDate)
            if (currentPeriod) {
                const count = await SQL.select().from(
                        SQL.table(Event.table)
                    )
                    .where(SQL.column('organizationId'), event.organizationId)
                    .where(SQL.column('typeId'), event.typeId)
                    .where(SQL.column('id'), SQLWhereSign.NotEqual, event.id)
                    .where(SQL.column('startDate'), SQLWhereSign.GreaterEqual, currentPeriod.startDate)
                    .where(SQL.column('endDate'), SQLWhereSign.LessEqual, currentPeriod.endDate)
                    .count()
                
                if (count >= type.maximum) {
                    throw new SimpleError({
                        code: 'type_maximum_reached',
                        message: 'Maximum number of events with this type reached',
                        human: 'Het maximum aantal voor ' + type.name + ' is bereikt (' + type.maximum + ')',
                        field: 'typeId'
                    })
                }
            } else {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'No period found for this start date',
                    human: 'Oeps, je kan nog geen evenementen van dit type aanmaken in deze periode',
                    field: 'startDate'
                })
            }
        }
    }
}
