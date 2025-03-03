import { AutoEncoderPatchType, Decoder, isEmptyPatch, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Member, RateLimiter } from '@stamhoofd/models';
import { MemberDetails, MembersBlob, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer';
import { PatchOrganizationMembersEndpoint } from '../../global/members/PatchOrganizationMembersEndpoint';
import { shouldCheckIfMemberIsDuplicateForPatch } from '../members/shouldCheckIfMemberIsDuplicate';
type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
type ResponseBody = MembersBlob;

export const securityCodeLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 a day
            limit: 10,
            duration: 24 * 60 * 1000 * 60,
        },
    ],
});

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PatchUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>, MemberWithRegistrationsBlob.patchType() as Decoder<AutoEncoderPatchType<MemberWithRegistrationsBlob>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        // Process changes
        const addedMembers: Member[] = [];
        for (const put of request.body.getPuts()) {
            const struct = put.put;

            const member = new Member();
            member.id = struct.id;
            member.organizationId = organization?.id ?? null;

            struct.details.cleanData();
            member.details = struct.details;

            this.throwIfInvalidDetails(member.details);

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, struct.details.securityCode, 'put');
            if (duplicate) {
                addedMembers.push(duplicate);
                continue;
            }

            await member.save();
            addedMembers.push(member);
        }

        // Modify members
        let members = await Member.getMembersWithRegistrationForUser(user);

        for (let struct of request.body.getPatches()) {
            const member = members.find(m => m.id === struct.id);
            if (!member) {
                throw Context.auth.memberNotFoundOrNoAccess();
            }

            const securityCode = struct.details?.securityCode; // will get cleared after the filter
            struct = await Context.auth.filterMemberPatch(member, struct);

            let shouldCheckDuplicate = false;

            if (struct.details) {
                if (struct.details.isPut()) {
                    throw new SimpleError({
                        code: 'not_allowed',
                        message: 'Cannot override details',
                        human: 'Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.',
                        field: 'details',
                    });
                }

                shouldCheckDuplicate = shouldCheckIfMemberIsDuplicateForPatch(struct, member.details);

                member.details.patchOrPut(struct.details);
                member.details.cleanData();
                this.throwIfInvalidDetails(member.details);
            }

            if (!member.details) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'No details provided',
                    human: 'Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.',
                    field: 'details',
                });
            }

            if (shouldCheckDuplicate) {
                const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, securityCode, 'patch');
                if (duplicate) {
                // Remove the member from the list
                    members.splice(members.findIndex(m => m.id === member.id), 1);

                    // Add new
                    addedMembers.push(duplicate);
                    continue;
                }
            }

            await member.save();

            // If parents changed or emergeny contacts: fetch family and merge data
            if (struct.details && (!isEmptyPatch(struct.details?.parents) || !isEmptyPatch(struct.details?.emergencyContacts))) {
                await PatchOrganizationMembersEndpoint.mergeDuplicateRelations(member, struct.details);
            }

            await MemberUserSyncer.onChangeMember(member);

            // Update documents
            await Document.updateForMember(member.id);
        }

        // Modify members
        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse('members').link(user, addedMembers);
        }

        await PatchOrganizationMembersEndpoint.deleteMembers(request.body.getDeletes());

        members = await Member.getMembersWithRegistrationForUser(user);

        for (const member of addedMembers) {
            const updatedMember = members.find(m => m.id === member.id);
            if (updatedMember) {
                // Make sure we also give access to other parents
                await MemberUserSyncer.onChangeMember(updatedMember);

                if (!updatedMember.users.find(u => u.id === user.id)) {
                    // Also link the user to the member if the email address is missing in the details
                    await MemberUserSyncer.linkUser(user.email, updatedMember, true);
                }

                await Document.updateForMember(updatedMember.id);
            }
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(members),
        );
    }

    private throwIfInvalidDetails(details: MemberDetails) {
        if (details.firstName.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Voornaam is te kort',
                field: 'firstName',
            });
        }

        if (details.lastName.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Achternaam is te kort',
                field: 'lastName',
            });
        }
    }
}
