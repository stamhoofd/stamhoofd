import {  ConvertArrayToPatchableArray,Decoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedMemberWithRegistrations,EncryptedMemberWithRegistrationsPatch } from "@stamhoofd/structures";

import { Member } from '../models/Member';
import { Registration } from '../models/Registration';
import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>
type ResponseBody = EncryptedMemberWithRegistrations[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EncryptedMemberWithRegistrations as any, EncryptedMemberWithRegistrationsPatch, StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access this endpoint",
                human: "Je hebt geen toegang tot deze functie"
            })
        }

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            // not supported yet
            throw new SimpleError({
                code: "not_supported",
                message: "Het is nog niet mogelijk om leden toe te voegen via deze api"
            })
        }

       // Loop all members one by one
        for (const patch of request.body.getPatches()) {
            const member = await Member.getByID(patch.id)
            if (!member || member.organizationId != user.organizationId) {
                 throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to access this endpoint",
                    human: "Je hebt geen toegang om dit lid te wijzigen"
                })
            }

            // Check permissions (todo)

            member.encryptedForMember = patch.encryptedForMember ?? member.encryptedForMember
            member.encryptedForOrganization = patch.encryptedForOrganization ?? member.encryptedForOrganization
            member.firstName = patch.firstName ?? member.firstName
            member.publicKey = patch.publicKey ?? member.publicKey
            await member.save();

            // Update registrations
            for (const patchRegistration of patch.registrations.getPatches()) {
                const registration = await Registration.getByID(patchRegistration.id)
                if (!registration || registration.memberId != member.id) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "You don't have permissions to access this endpoint",
                        human: "Je hebt geen toegang om deze registratie te wijzigen"
                    })
                }

                // todo: allow group changes

                registration.waitingList = patchRegistration.waitingList ?? registration.waitingList
                registration.canRegister = patchRegistration.canRegister ?? registration.canRegister

                // Check if we should create a placeholder payment?
                await registration.save()
            }
        }

        return new Response([]);
    }

}
