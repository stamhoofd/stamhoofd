import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Member } from '@stamhoofd/models';
import { MemberWithRegistrationsBlob, MembersBlob } from "@stamhoofd/structures";

import { Context } from '../../../helpers/Context';
import { PatchOrganizationMembersEndpoint } from '../../global/members/PatchOrganizationMembersEndpoint';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
type ResponseBody = MembersBlob

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PatchUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>, MemberWithRegistrationsBlob.patchType() as Decoder<AutoEncoderPatchType<MemberWithRegistrationsBlob>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const {user} = await Context.authenticate()

        // Process changes
        const addedMembers: Member[] = []
        for (const put of request.body.getPuts()) {
            const struct = put.put

            const member = new Member()
            member.id = struct.id
            member.organizationId = organization?.id ?? null

            struct.details.cleanData()
            member.details = struct.details

            if (!struct.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }

            // Check for duplicates and prevent creating a duplicate member by a user
            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member);
            if (duplicate) {
                // Merge data
                duplicate.details.merge(member.details)
                await duplicate.save()
                addedMembers.push(duplicate)
                continue;
            }

            await member.save()
            addedMembers.push(member)
        }

        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse("members").link(user, addedMembers)

        }

        // Modify members
        const members = await Member.getMembersWithRegistrationForUser(user)

        for (const member of addedMembers) {
            const updatedMember = members.find(m => m.id === member.id);
            if (updatedMember) {
                // Make sure we also give access to other parents
                await PatchOrganizationMembersEndpoint.updateManagers(updatedMember)
                await Document.updateForMember(updatedMember.id)
            }
        }

        for (const struct of request.body.getPatches()) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }

            if (struct.details) {
                if (struct.details.isPut()) {
                    throw new SimpleError({
                        code: "not_allowed",
                        message: "Cannot override details",
                        human: "Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.",
                        field: "details"
                    })
                }
                member.details.patchOrPut(struct.details)
                member.details.cleanData()
            }

            if (!member.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }
            await member.save();
            await PatchOrganizationMembersEndpoint.updateManagers(member)

            // Update documents
            await Document.updateForMember(member.id)
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(members)
        );
    }
}
