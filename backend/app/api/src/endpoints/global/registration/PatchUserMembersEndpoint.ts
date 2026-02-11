import { AutoEncoderPatchType, Decoder, isEmptyPatch, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Group, Member, RateLimiter, Registration } from '@stamhoofd/models';
import { MemberDetails, MembersBlob, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

import { OneToManyRelation } from '@simonbackx/simple-database';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer.js';
import { didUitpasReviewChange, updateMemberDetailsUitpasNumber, updateMemberDetailsUitpasNumberForPatch } from '../../../helpers/updateMemberDetailsUitpasNumber.js';
import { PatchOrganizationMembersEndpoint } from '../../global/members/PatchOrganizationMembersEndpoint.js';
import { shouldCheckIfMemberIsDuplicateForPatch } from '../members/shouldCheckIfMemberIsDuplicate.js';
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

            const member = new Member()
                .setManyRelation(Member.registrations as any as OneToManyRelation<'registrations', Member, Registration & { group: Group }>, [])
                .setManyRelation(Member.users, []);
            member.id = struct.id;
            member.organizationId = organization?.id ?? null;

            const securityCode = struct.details.securityCode; // will get cleared after the filter
            Context.auth.filterMemberPut(member, struct, { asUserManager: true });

            await updateMemberDetailsUitpasNumber(struct.details);
            struct.details.cleanData();
            member.details = struct.details;

            this.throwIfInvalidDetails(member.details);

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, securityCode, 'put');
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
                        human: $t(`b66ef4c3-9931-4fc3-9da1-c023857684fa`),
                        field: 'details',
                    });
                }

                shouldCheckDuplicate = shouldCheckIfMemberIsDuplicateForPatch(struct, member.details);

                const previousUitpasNumber = member.details.uitpasNumberDetails?.uitpasNumber ?? null;

                const originalReviewTimes = member.details.reviewTimes;
                member.details.patchOrPut(struct.details);

                if (struct.details.uitpasNumberDetails || didUitpasReviewChange(struct.details.reviewTimes, originalReviewTimes)) {
                    await updateMemberDetailsUitpasNumberForPatch(member.id, member.details, previousUitpasNumber);
                }

                member.details.cleanData();
                this.throwIfInvalidDetails(member.details);
            }

            if (!member.details) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'No details provided',
                    human: $t(`c43b9970-bcf2-472d-ac3a-65f3be5765c5`),
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
            await Document.updateForMember(member);
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

                await Document.updateForMember(updatedMember);
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
                message: $t(`cdd2e8bd-ebda-4c85-acc3-dbe1a5cfeff5`),
                field: 'firstName',
            });
        }

        if (details.lastName.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`ca519528-c0cb-4e4f-94c7-f0f160312fb8`),
                field: 'lastName',
            });
        }
    }
}
