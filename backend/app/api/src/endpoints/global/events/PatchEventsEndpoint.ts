import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Event } from '@stamhoofd/models';
import { Event as EventStruct, GroupType, PermissionLevel } from "@stamhoofd/structures";

import { SimpleError } from '@simonbackx/simple-errors';
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
            event.typeId = put.typeId

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
            event.typeId = patch.typeId ?? event.typeId

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
}
