import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { RegistrationInvitation as RegistrationInvitationStruct } from '@stamhoofd/structures';
import { GroupType, PermissionLevel, RegistrationInvitationRequest } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, RegistrationInvitation } from '@stamhoofd/models';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<RegistrationInvitationRequest>;
type ResponseBody = RegistrationInvitationStruct[];

export class PatchRegistrationInvitationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
     
    bodyDecoder = new PatchableArrayDecoder(
        RegistrationInvitationRequest as Decoder<RegistrationInvitationRequest>,
        RegistrationInvitationRequest.patchType() as Decoder<AutoEncoderPatchType<RegistrationInvitationRequest>>,
        StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/registration-invitations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    private async updateInvitation(invitation: RegistrationInvitation) {
        try {
            const duplicate = await RegistrationInvitation.select()
                .where('groupId', invitation.groupId)
                .andWhere('memberId', invitation.memberId).first(false);

            if (duplicate) {
                duplicate.createdAt = invitation.createdAt;
                await duplicate.save();
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const invitations: RegistrationInvitation[] = [];
        let duplicateCount = 0;

        const puts = request.body.getPuts();
        for (const { put } of puts) {
            await this.checkCanCreateRegistrationInvitation(put, organization.id);

            const invitation = new RegistrationInvitation();
            invitation.id = put.id;
            invitation.organizationId = organization.id;
            invitation.groupId = put.groupId;
            invitation.memberId = put.memberId;

            try {
                await invitation.save();
                invitations.push(invitation);
            } catch (e) {
                // update if duplicate
                if (e.code === 'ER_DUP_ENTRY') {
                    await this.updateInvitation(invitation);

                    duplicateCount += 1;
                    continue;
                } else {
                    throw e;
                }
            }
        }

        if (request.body.getPatches().length > 0) {
            throw new SimpleError({
                code: 'patch_not_supported',
                statusCode: 405,
                message: 'Patching invitations is not supported. Only puts and deletes are supported.',
            });
        }

        for (const id of request.body.getDeletes()) {
            const invitation = await RegistrationInvitation.getByID(id);
            if (!invitation) {
                throw new SimpleError({
                    code: 'not_found',
                    statusCode: 404,
                    message: 'Registration invitation not found',
                });
            }

            // Anyone with write access to the group can delete invitations for the group
            const group = await Group.getByID(invitation.groupId);
    
            if (!group || !await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                throw Context.auth.error($t(`Je hebt geen toegansrechten om deze uitnodiging te verwijderen.`));
            }

            await invitation.delete();
        }

        // show an error if all puts were duplicates
        if (puts.length > 0 && puts.length === duplicateCount) {
            throw new SimpleError({
                code: 'duplicate_entry',
                statusCode: 409,
                message: 'Duplicate entry',
                human: puts.length === 1 ? $t(`Het lid is al uitgenodigd voor deze groep.`) : $t(`De leden werden al uitgenodigd.`),
            });
        }

        return new Response(
            await AuthenticatedStructures.registrationInvitations(invitations),
        );
    }

    /**
     * Will throw if not allowed to invite.
     * @param invitation
     * @param organizationId id of organization to invite for, should match the organizationId in the invitation
     */
    private async checkCanCreateRegistrationInvitation(invitation: RegistrationInvitationRequest, organizationId: string) {
        const group = await Group.getByID(invitation.groupId);

        if (!group || group.organizationId !== organizationId || !await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
            throw Context.auth.error($t(`Je hebt geen toegansrechten om iemand uit te nodigen voor deze groep.`));
        }

        // cannot invite for waiting list
        if (group.type === GroupType.WaitingList) {
            throw new SimpleError({
                code: 'bad_group',
                statusCode: 400,
                message: 'Not allowed to invite for waiting list',
            });
        }

        const member = await Member.getByIdWithUsersAndRegistrations(invitation.memberId);
        
        if (!member
            // in userMode 'organization' we can only invite members from the same organization
            || (STAMHOOFD.userMode === 'organization' && member.organizationId !== organizationId)
            // read access is suficient
            || !await Context.auth.canAccessMember(member, PermissionLevel.Read)
            ) {
                throw Context.auth.error($t(`Je hebt geen toegansrechten om dit lid uit te nodigen.`));
        }

        // cannot invite if already registered
        if (member.registrations.some(r => r.groupId === group.id && r.registeredAt !== null && r.deactivatedAt === null)) {
            throw new SimpleError({
                code: 'bad_group',
                statusCode: 400,
                message: 'The member is already registered for this group',
                human: $t('Dit lid is al ingeschreven voor deze groep'),
            })
        }
    }
}
