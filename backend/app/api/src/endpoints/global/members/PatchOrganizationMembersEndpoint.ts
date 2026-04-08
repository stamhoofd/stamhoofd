import type { OneToManyRelation } from '@simonbackx/simple-database';
import type { AutoEncoderPatchType, ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { isEmptyPatch, isPatchableArray, PatchableArray, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { MemberWithUsersRegistrationsAndGroups, Registration } from '@stamhoofd/models';
import { AuditLog, BalanceItem, Document, Group, Member, MemberFactory, MemberPlatformMembership, MemberResponsibilityRecord, mergeTwoMembers, Organization, Platform, RateLimiter, RegistrationPeriod, User } from '@stamhoofd/models';
import type { MemberResponsibility, MembersBlob } from '@stamhoofd/structures';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType, EmergencyContact, GroupType, MemberDetails, MemberWithRegistrationsBlob, Parent, PermissionLevel, PlatformMembershipTypeBehaviour, SetupStepType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Email } from '@stamhoofd/email';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { MembershipCharger } from '../../../helpers/MembershipCharger.js';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer.js';
import { SetupStepUpdater } from '../../../helpers/SetupStepUpdater.js';
import { didUitpasReviewChange, updateMemberDetailsUitpasNumber, updateMemberDetailsUitpasNumberForPatch } from '../../../helpers/updateMemberDetailsUitpasNumber.js';
import { MemberNumberService } from '../../../services/MemberNumberService.js';
import { PlatformMembershipService } from '../../../services/PlatformMembershipService.js';
import { RegistrationService } from '../../../services/RegistrationService.js';
import { shouldCheckIfMemberIsDuplicateForPatch } from './shouldCheckIfMemberIsDuplicate.js';

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
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as any, MemberWithRegistrationsBlob.patchType(), StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<MemberWithRegistrationsBlob[]>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    private static throwDuplicateMemberNumberError(error: unknown): never {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY' && 'message' in error && typeof error.message === 'string' && error.message.includes('memberNumber')) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Member number already in use',
                human: $t('Dit lidnummer is al in gebruik'),
                field: 'details.memberNumber',
            });
        }
        throw error;
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
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

        const members: MemberWithUsersRegistrationsAndGroups[] = [];

        const platform = await Platform.getShared();

        const updateMembershipMemberIds = new Set<string>();
        const updateMembershipsForOrganizations = new Set<string>();

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            const struct = put.put;
            let member = new Member()
                .setManyRelation(Member.registrations as any as OneToManyRelation<'registrations', Member, Registration & { group: Group }>, [])
                .setManyRelation(Member.users, []);
            member.id = struct.id;

            if (organization && STAMHOOFD.userMode !== 'platform') {
                member.organizationId = organization.id;
            }
            const securityCode = struct.details.securityCode; // will get cleared after the filter
            Context.auth.filterMemberPut(member, struct, { asUserManager: false });

            await updateMemberDetailsUitpasNumber(struct.details);
            struct.details.cleanData();
            member.details = struct.details;

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, securityCode, 'put');
            if (duplicate) {
                // Merge data
                member = duplicate;
            }

            // We risk creating a new member without being able to access it manually afterwards
            // Cache access to this member temporarily in memory
            await Context.auth.temporarilyGrantMemberAccess(member, PermissionLevel.Full);

            if (STAMHOOFD.userMode !== 'platform' && !member.organizationId) {
                throw new SimpleError({
                    code: 'missing_organization',
                    message: 'Missing organization',
                    human: $t(`%Di`),
                    statusCode: 400,
                });
            }

            /**
             * In development mode, we allow some secret usernames to create fake data
             */
            if ((STAMHOOFD.environment === 'development' || STAMHOOFD.environment === 'staging') && organization) {
                if (member.details.firstName.toLocaleLowerCase() === 'create' && parseInt(member.details.lastName) > 0) {
                    const count = parseInt(member.details.lastName);
                    await this.createDummyMembers(organization, count);

                    // Skip creating this member
                    continue;
                }
            }

            try {
                await member.save();
            }
            catch (error) {
                PatchOrganizationMembersEndpoint.throwDuplicateMemberNumberError(error);
            }
            members.push(member);
            updateMembershipMemberIds.add(member.id);

            // Auto link users based on data
            await MemberUserSyncer.onChangeMember(member);
        }

        let shouldUpdateSetupSteps = false;

        // Loop all members one by one
        for (let patch of request.body.getPatches()) {
            const member = members.find(m => m.id === patch.id) ?? await Member.getWithRegistrations(patch.id);
            const securityCode = patch.details?.securityCode; // will get cleared after the filter

            if (!member) {
                throw Context.auth.memberNotFoundOrNoAccess();
            }

            await PatchOrganizationMembersEndpoint.checkCanAccessMember(member, securityCode, 'patch');

            patch = await Context.auth.filterMemberPatch(member, patch);
            const originalDetails = member.details.clone();

            let shouldCheckDuplicate = false;

            if (patch.details) {
                if (patch.details.isPut()) {
                    throw new SimpleError({
                        code: 'not_allowed',
                        message: 'Cannot override details',
                        human: $t(`%Dj`),
                        field: 'details',
                    });
                }

                shouldCheckDuplicate = shouldCheckIfMemberIsDuplicateForPatch(patch, originalDetails);

                const wasReduced = member.details.shouldApplyReducedPrice;

                const originalReviewTimes = member.details.reviewTimes;
                const previousUitpasNumber = member.details.uitpasNumberDetails?.uitpasNumber ?? null;
                member.details.patchOrPut(patch.details);

                if (patch.details.uitpasNumberDetails || didUitpasReviewChange(patch.details.reviewTimes, originalReviewTimes)) {
                    await updateMemberDetailsUitpasNumberForPatch(member.id, member.details, previousUitpasNumber);
                }

                member.details.cleanData();

                if (wasReduced !== member.details.shouldApplyReducedPrice) {
                    updateMembershipMemberIds.add(member.id);
                }
            }

            if (shouldCheckDuplicate) {
                const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, securityCode, 'patch');

                if (duplicate) {
                    // Remove the member from the list
                    const iii = members.findIndex(m => m.id === member.id);
                    if (iii !== -1) {
                        members.splice(iii, 1);
                    }

                    // Add new
                    members.push(duplicate);
                    continue;
                }
            }

            try {
                await member.save();
            }
            catch (error) {
                PatchOrganizationMembersEndpoint.throwDuplicateMemberNumberError(error);
            }

            // If parents changed or emergeny contacts: fetch family and merge data
            if (patch.details && (!isEmptyPatch(patch.details?.parents) || !isEmptyPatch(patch.details?.emergencyContacts))) {
                await PatchOrganizationMembersEndpoint.mergeDuplicateRelations(member, patch.details);
            }

            // Update documents
            await Document.updateForMember(member);

            // Update responsibilities
            for (const patchResponsibility of patch.responsibilities.getPatches()) {
                if (!Context.auth.hasPlatformFullAccess() && !(organization && await Context.auth.hasFullAccess(organization.id))) {
                    throw Context.auth.error($t(`%Dk`));
                }

                const responsibilityRecord = await MemberResponsibilityRecord.getByID(patchResponsibility.id);
                if (!responsibilityRecord || responsibilityRecord.memberId !== member.id || (organization && responsibilityRecord.organizationId !== organization.id)) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: "You don't have permissions to access this endpoint",
                        human: $t(`%Dl`),
                    });
                }

                const responsibility = platform.config.responsibilities.find(r => r.id === patchResponsibility.responsibilityId);

                if (responsibility && !responsibility.organizationBased && !Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error($t(`%Dm`));
                }

                // Allow patching begin and end date
                if (patchResponsibility.endDate !== undefined) {
                    if (responsibilityRecord.endDate) {
                        if (!Context.auth.hasPlatformFullAccess()) {
                            throw Context.auth.error($t(`%Dn`));
                        }
                    }
                    responsibilityRecord.endDate = patchResponsibility.endDate;
                }

                if (patchResponsibility.startDate !== undefined) {
                    if (patchResponsibility.startDate.getTime() > Date.now() + 5 * 60 * 1000) {
                        throw Context.auth.error($t(`%Do`));
                    }
                    if (patchResponsibility.startDate.getTime() > Date.now()) {
                        patchResponsibility.startDate = new Date(); // force now
                    }

                    const daysDiff = Math.abs((new Date().getTime() - patchResponsibility.startDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysDiff > 60 && !Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error($t(`%Dp`));
                    }
                    responsibilityRecord.startDate = patchResponsibility.startDate;
                }

                // Check maximum
                if (responsibility) {
                    await this.checkResponsbilityLimits(responsibilityRecord, responsibility);
                }

                await responsibilityRecord.save();
                shouldUpdateSetupSteps = true;
            }

            // Create responsibilities
            for (const { put } of patch.responsibilities.getPuts()) {
                if (!Context.auth.hasPlatformFullAccess() && !(organization && await Context.auth.hasFullAccess(organization.id))) {
                    throw Context.auth.error($t(`%Dk`));
                }

                const platformResponsibility = platform.config.responsibilities.find(r => r.id === put.responsibilityId);
                const org = organization ?? (put.organizationId ? await Organization.getByID(put.organizationId) : null);

                if (!org && put.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: $t(`%Dq`),
                        field: 'organizationId',
                    });
                }
                const responsibility = platformResponsibility ?? org?.privateMeta.responsibilities.find(r => r.id === put.responsibilityId);

                if (!responsibility) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid responsibility',
                        human: $t(`%Dr`),
                        field: 'responsibilityId',
                    });
                }

                if (!org && responsibility.organizationBased) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: $t(`%Ds`),
                        field: 'organizationId',
                    });
                }

                const hasRegistration = member.registrations.some((registration) => {
                    if (platformResponsibility) {
                        if (registration.group.defaultAgeGroupId === null) {
                            return false;
                        }
                    }

                    if (org) {
                        if (registration.periodId !== org.periodId) {
                            return false;
                        }
                    }
                    else {
                        if (registration.periodId !== platform.periodIdIfPlatform) {
                            return false;
                        }
                    }
                    return registration.deactivatedAt === null && registration.registeredAt !== null && registration.group.type === GroupType.Membership;
                });

                if (!hasRegistration) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: platformResponsibility ? $t('%1B9') : $t('%8G'),
                    });
                }

                const model = new MemberResponsibilityRecord();
                model.memberId = member.id;
                model.responsibilityId = responsibility.id;
                model.organizationId = org?.id ?? null;

                if (responsibility.organizationTagIds !== null && (!org || !org.meta.matchTags(responsibility.organizationTagIds))) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: $t(`%Dt`),
                        field: 'organizationId',
                    });
                }

                if (responsibility.defaultAgeGroupIds !== null) {
                    if (!put.groupId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Missing groupId',
                            human: $t(`%Du`),
                            field: 'groupId',
                        });
                    }

                    const group = await Group.getByID(put.groupId);
                    if (!group || group.organizationId !== model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid groupId',
                            human: $t(`%Dv`),
                            field: 'groupId',
                        });
                    }

                    if (group.defaultAgeGroupId === null || !responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid groupId',
                            human: $t(`%Dw`),
                            field: 'groupId',
                        });
                    }

                    model.groupId = group.id;
                }

                // Allow patching begin and end date
                model.endDate = put.endDate;

                if (put.startDate.getTime() > Date.now() + 5 * 60 * 1000) {
                    throw Context.auth.error($t(`%Do`));
                }

                if (put.startDate.getTime() > Date.now()) {
                    put.startDate = new Date(); // force now
                }

                if (put.endDate && put.endDate > new Date(Date.now() + 60 * 1000)) {
                    throw Context.auth.error($t(`%Dx`));
                }

                model.startDate = put.startDate;

                // Check maximum
                await this.checkResponsbilityLimits(model, responsibility);

                await model.save();
                shouldUpdateSetupSteps = true;
            }

            // Auto link users based on data
            await MemberUserSyncer.onChangeMember(member);

            // Allow to remove access for certain users
            for (const id of patch.users.getDeletes()) {
                const user = member.users.find(u => u.id === id);
                if (!user) {
                    // Ignore silently
                    continue;
                }

                if (MemberUserSyncer.doesEmailHaveAccess(member.details, user.email)) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid email',
                        human: $t(`%Dy`),
                    });
                }

                // Remove access
                await MemberUserSyncer.unlinkUser(user, member);
            }

            // Add platform memberships
            for (const { put } of patch.platformMemberships.getPuts()) {
                if (put.periodId !== platform.periodId) {
                    const period = await RegistrationPeriod.getByID(put.periodId);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`%A9`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`%AA`, { period: period?.getBaseStructure().name }),
                            field: 'periodId',
                        });
                    }
                }

                if (organization && put.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: $t(`%Dz`),
                        field: 'organizationId',
                    });
                }

                if (!await Context.auth.hasFullAccess(put.organizationId)) {
                    throw Context.auth.error($t(`%E0`));
                }

                const putForOrganization = await Context.auth.getOrganization(put.organizationId);

                const membershipType = platform.config.membershipTypes.find(t => t.id === put.membershipTypeId);

                if (!membershipType) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'membershipTypeId',
                        message: 'Invalid membership type',
                        human: $t(`%E1`),
                    });
                }

                const organizationTags = putForOrganization.meta.tags ?? [];
                const memberDefaultAgeGroupIds: string[] = [];

                for (const r of member.registrations) {
                    if (r.periodId !== put.periodId || r.deactivatedAt !== null || r.registeredAt === null || r.group.defaultAgeGroupId === null) {
                        continue;
                    }

                    memberDefaultAgeGroupIds.push(r.group.defaultAgeGroupId);
                }

                const isEnabled = membershipType.isEnabled(organizationTags, memberDefaultAgeGroupIds);

                if (!isEnabled) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'membershipTypeId',
                        message: 'Invalid membership type',
                        human: $t(`%E2`),
                    });
                }

                const membership = new MemberPlatformMembership();
                membership.id = put.id;
                membership.memberId = member.id;
                membership.membershipTypeId = put.membershipTypeId;
                membership.organizationId = put.organizationId;
                membership.periodId = put.periodId;

                membership.startDate = put.startDate;
                membership.endDate = put.endDate;
                membership.expireDate = put.expireDate;
                membership.locked = false;

                // Correct price and dates
                await membership.calculatePrice(member);

                // Check duplicate memberships after correcting the dates
                const existing = await MemberPlatformMembership.select()
                    .where('memberId', member.id)
                    .where('membershipTypeId', put.membershipTypeId)
                    .where('periodId', put.periodId)
                    .where('deletedAt', null)
                    .where(
                        SQL.where(
                            SQL.where('startDate', SQLWhereSign.LessEqual, put.startDate)
                                .and('endDate', SQLWhereSign.GreaterEqual, put.startDate),
                        )
                            .or(
                                SQL.where('startDate', SQLWhereSign.LessEqual, put.endDate)
                                    .and('endDate', SQLWhereSign.GreaterEqual, put.endDate),
                            )
                            .or(
                                SQL.where('startDate', SQLWhereSign.GreaterEqual, put.startDate)
                                    .and('endDate', SQLWhereSign.LessEqual, put.endDate),
                            ),
                    )
                    .first(false);

                if (existing && (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days || !existing.generated || existing.locked || existing.price < membership.price)) {
                    if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'startDate',
                            message: 'Overlapping memberships',
                            human: $t(`%1NA`),
                        });
                    }
                    if (existing.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'startDate',
                            message: 'Overlapping memberships',
                            human: $t(`%1NB`),
                        });
                    }
                    if (!existing.generated) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'startDate',
                            message: 'Overlapping memberships',
                            human: $t(`%1NC`),
                        });
                    }
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'startDate',
                        message: 'Overlapping memberships',
                        human: $t(`%1ND`),
                    });
                }
                else if (existing) {
                    await existing.doDelete();
                }

                // Save if okay
                await membership.save();

                if (member.details.memberNumber === null) {
                    try {
                        await MemberNumberService.assignMemberNumber(member, membership);
                    }
                    catch (error) {
                        console.error(`Failed to assign member number for id ${member.id}: ${error.message}`);
                        // If the assignment of the member number fails the membership is not created but the member is registered
                        continue;
                    }
                }

                updateMembershipMemberIds.add(member.id);
            }

            for (const p of patch.platformMemberships.getPatches()) {
                const membership = await MemberPlatformMembership.getByID(p.id);

                if (!membership || membership.memberId !== member.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'id',
                        message: 'Invalid id',
                        human: $t(`%E3`),
                    });
                }

                if (!await Context.auth.hasFullAccess(membership.organizationId)) {
                    throw Context.auth.error($t(`%E4`));
                }

                if (membership.periodId !== platform.periodId) {
                    const period = await RegistrationPeriod.getByID(membership.periodId);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: $t(`%BZ`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: $t(`%Ba`),
                            field: 'periodId',
                        });
                    }
                }

                // For now only alter 'locked'
                if (Context.auth.hasPlatformFullAccess()) {
                    membership.locked = p.locked ?? membership.locked;
                    await membership.save();
                }
                else {
                    if (p.locked === true) {
                        throw Context.auth.error($t('%BX'));
                    }

                    if (p.locked === false) {
                        throw Context.auth.error($t('%BY'));
                    }
                }

                updateMembershipsForOrganizations.add(membership.organizationId); // can influence free memberships in other members of same organization
                updateMembershipMemberIds.add(member.id);
            }

            // Delete platform memberships
            for (const id of patch.platformMemberships.getDeletes()) {
                const membership = await MemberPlatformMembership.getByID(id);

                if (!membership || membership.memberId !== member.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'id',
                        message: 'Invalid id',
                        human: $t(`%E3`),
                    });
                }

                if (!await Context.auth.hasFullAccess(membership.organizationId)) {
                    throw Context.auth.error($t(`%E5`));
                }

                if (membership.periodId !== platform.periodId) {
                    const period = await RegistrationPeriod.getByID(membership.periodId);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`%AB`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`%AC`, { period: period?.getBaseStructure().name }),
                            field: 'periodId',
                        });
                    }
                }

                if (!membership.canDelete(Context.auth.hasPlatformFullAccess())) {
                    if (membership.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid invoice',
                            human: $t(`%E6`),
                        });
                    }

                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid invoice',
                        human: $t(`%E7`),
                    });
                }

                await membership.doDelete();
                updateMembershipsForOrganizations.add(membership.organizationId); // can influence free memberships in other members of same organization
                updateMembershipMemberIds.add(member.id);
            }

            if (!members.find(m => m.id === member.id)) {
                members.push(member);
            }
        }

        await PatchOrganizationMembersEndpoint.deleteMembers(request.body.getDeletes());

        for (const member of members) {
            if (updateMembershipMemberIds.has(member.id)) {
                await PlatformMembershipService.updateMembershipsForId(member.id);
            }
        }

        if (updateMembershipsForOrganizations.size) {
            QueueHandler.schedule('update-organization-membership-prices', async () => {
                for (const id of updateMembershipsForOrganizations) {
                    await MembershipCharger.updatePrices(id);
                }
            }).catch(console.error);
        }

        if (shouldUpdateSetupSteps && organization) {
            SetupStepUpdater.updateForOrganization(organization, { types: [
                SetupStepType.Responsibilities,
            ] }).catch(console.error);
        }

        const r = await AuthenticatedStructures.membersBlob(members);

        return new Response(
            r,
        );
    }

    static async deleteMembers(ids: string[]) {
        const updateGroups = new Set<string>();
        const updateRegistrations = new Map<string, Registration>();
        const updateSteps = new Set<string>();

        // Loop all members one by one
        for (const id of ids) {
            const member = await Member.getByIdWithUsersAndRegistrations(id);
            if (!member || !await Context.auth.canDeleteMember(member)) {
                throw Context.auth.error($t(`%E8`));
            }

            await MemberUserSyncer.onDeleteMember(member);
            await User.deleteForDeletedMember(member.id);
            await BalanceItem.deleteForDeletedMember(member.id);
            await member.delete();

            for (const registration of member.registrations) {
                const groupId = registration.groupId;
                updateRegistrations.set(registration.id, registration);
                updateGroups.add(groupId);
                updateSteps.add(registration.organizationId);
            }
        }

        for (const registration of updateRegistrations.values()) {
            RegistrationService.scheduleStockUpdate(registration.id);
        }

        const groups = await Group.getByIDs(...Array.from(updateGroups));

        // Loop all groups and update occupancy if needed
        for (const group of groups) {
            await group.updateOccupancy();
            await group.save();
        }

        const organizations = await Organization.getByIDs(...Array.from(updateSteps));

        for (const organization of organizations) {
            SetupStepUpdater.updateForOrganization(organization).catch(console.error);
        }
    }

    static async mergeDuplicateRelations(member: Member, patch: AutoEncoderPatchType<MemberDetails> | MemberDetails) {
        const __familyMembers = await Member.getFamily(member.id);
        const _familyMembers = await Member.loadRegistrationsAndUsers(__familyMembers);
        const familyMembers: Member[] = [];
        // Only modify members if we have write access to them (this avoids issues with overriding data)
        for (const member of _familyMembers) {
            if (await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
                familyMembers.push(member);
            }
        }

        // Replace member with member
        const memberIndex = familyMembers.findIndex(m => m.id === member.id);
        if (memberIndex !== -1 && familyMembers.length >= 2) {
            familyMembers[memberIndex] = member;
            const parentMergeMap = MemberDetails.mergeParents(
                familyMembers.map(m => m.details),
                true, // Allow deletes
            );
            const contactsMergeMap = MemberDetails.mergeEmergencyContacts(
                familyMembers.map(m => m.details),
                true, // Allow deletes
            );

            // If there were patches or puts of parents or emergency contacts
            // Make sure that those patches have been applied even after a potential merge
            // E.g. you only changed the email, but there was a more recent parent object in a different member
            // -> avoid losing the email change
            const parentPatches = isPatchableArray(patch.parents) ? patch.parents.getPatches() : [];

            // Add puts
            const parentPuts = isPatchableArray(patch.parents) ? patch.parents.getPuts().map(p => p.put) : patch.parents;
            for (const put of parentPuts) {
                if (!parentMergeMap.get(put.id)) {
                    // This one has not been merged
                    continue;
                }

                const alternativeEmailsArr = new PatchableArray() as PatchableArray<string, string, string>;
                for (const alternativeEmail of put.alternativeEmails) {
                    alternativeEmailsArr.addPut(alternativeEmail);
                }

                const p = Parent.patch({
                    ...put,
                    alternativeEmails: alternativeEmailsArr,
                    createdAt: undefined, // Not allowed to change (should have already happened + the merge method will already chose the right value)
                    updatedAt: undefined, // Not allowed to change (should have already happened + the merge method will already chose the right value)
                });

                // Delete null values or empty strings
                for (const key in p) {
                    if (p[key] === null || p[key] === '') {
                        delete p[key];
                    }
                }

                parentPatches.push(p);
            }

            // Same for emergency contacts
            const contactsPatches = isPatchableArray(patch.emergencyContacts) ? patch.emergencyContacts.getPatches() : [];

            // Add puts
            const contactsPuts = isPatchableArray(patch.emergencyContacts) ? patch.emergencyContacts.getPuts().map(p => p.put) : patch.emergencyContacts;
            for (const put of contactsPuts) {
                if (!contactsMergeMap.get(put.id)) {
                    // This one has not been merged
                    continue;
                }
                const p = EmergencyContact.patch({
                    ...put,
                    createdAt: undefined, // Not allowed to change (should have already happened + the merge method will already chose the right value)
                    updatedAt: undefined, // Not allowed to change (should have already happened + the merge method will already chose the right value)
                });

                // Delete null values or empty strings
                for (const key in p) {
                    if (p[key] === null || p[key] === '') {
                        delete p[key];
                    }
                }

                contactsPatches.push(p);
            }

            // Apply patches
            for (const parentPatch of parentPatches) {
                for (const m of familyMembers) {
                    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
                    parentPatch.id = parentMergeMap.get(parentPatch.id) ?? parentPatch.id;
                    arr.addPatch(parentPatch);
                    m.details = m.details.patch({
                        parents: arr,
                    });
                }
            }

            // Apply patches
            for (const contactPatch of contactsPatches) {
                for (const m of familyMembers) {
                    const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
                    contactPatch.id = contactsMergeMap.get(contactPatch.id) ?? contactPatch.id;
                    arr.addPatch(contactPatch);
                    m.details = m.details.patch({
                        emergencyContacts: arr,
                    });
                }
            }

            for (const m of familyMembers) {
                m.details.cleanData();

                if (await m.save() && m.id !== member.id) {
                    // Auto link users based on data
                    await MemberUserSyncer.onChangeMember(m);

                    // Update documents
                    await Document.updateForMember(m);
                }
            }
        }
    }

    static async findExistingMember(member: Member) {
        if (!member.details.birthDay) {
            return;
        }
        let existingMembers = await Member.where({ organizationId: member.organizationId, firstName: member.details.firstName, lastName: member.details.lastName, birthDay: Formatter.dateIso(member.details.birthDay) });

        if (member.existsInDatabase) {
            existingMembers = existingMembers.filter(e => e.id !== member.id);
        }

        if (existingMembers.length > 0) {
            const withRegistrations = await Member.getBlobByIds(...existingMembers.map(m => m.id));
            for (const m of withRegistrations) {
                if (m.registrations.length > 0) {
                    return m;
                }
            }

            if (withRegistrations.length > 0) {
                return withRegistrations[0];
            }
        }
    }

    private static async checkSecurityCode(member: MemberWithUsersRegistrationsAndGroups, securityCode: string) {
        try {
            securityCodeLimiter.track(member.details.name, 1);
        }
        catch (e) {
            Email.sendWebmaster({
                subject: $t(`%E9`),
                text: $t(`%EA`) + ' ' + member.details.name + ' ' + $t(`%1G`) + ' ' + member.id + ')' + '\n\n' + e.message + '\n\nStamhoofd',
            });

            throw new SimpleError({
                code: 'too_many_tries',
                message: 'Too many securityCodes limited',
                human: $t(`%EB`),
                field: 'details.securityCode',
            });
        }

        // Entered the security code, so we can link the user to the member
        if (STAMHOOFD.environment !== 'development') {
            if (!member.details.securityCode || securityCode !== member.details.securityCode) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'details.securityCode',
                    message: 'Invalid security code',
                    human: Context.i18n.$t('%2i'),
                    statusCode: 400,
                });
            }
        }

        console.log('checkSecurityCode: security code is correct - for ' + member.id);

        // Grant temporary access to this member without needing to enter the security code again
        await Context.auth.temporarilyGrantMemberAccess(member, PermissionLevel.Full);

        const log = new AuditLog();

        // a member has multiple organizations, so this is difficult to determine - for now it is only visible in the admin panel
        log.organizationId = member.organizationId;

        log.type = AuditLogType.MemberSecurityCodeUsed;
        log.source = AuditLogSource.Anonymous;

        if (Context.user) {
            log.userId = Context.user.id;
            log.source = AuditLogSource.User;
        }

        log.objectId = member.id;
        log.replacements = new Map([
            ['m', AuditLogReplacement.create({
                value: member.details.name,
                type: AuditLogReplacementType.Member,
                id: member.id,
            })],
        ]);
        await log.save();
    }

    static async checkCanAccessMember(member: MemberWithUsersRegistrationsAndGroups, securityCode: string | null | undefined, type: 'put' | 'patch') {
        // do not check security code for user mode organization (throw error if not allowed)
        if (STAMHOOFD.userMode === 'organization') {
            if ((type === 'put' && await member.isSafeToMergeDuplicateWithoutSecurityCode()) || await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
                console.log('checkSecurityCode: allowed for ' + member.id);
                return;
            }

            if (type === 'patch') {
                throw Context.auth.memberNotFoundOrNoAccess();
            }

            throw new SimpleError({
                code: 'known_member_missing_rights',
                message: 'Creating known member without sufficient access rights',
                // different message for userMode organization because security codes are not available in that mode
                human: $t(`{member} is al gekend in ons systeem, maar jouw e-mailadres niet. Neem contact op met de vereniging.`, { member: member.details.firstName }),
                statusCode: 400,
            });
        }

        if ((type === 'put' && await member.isSafeToMergeDuplicateWithoutSecurityCode()) || await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
            console.log('checkSecurityCode: without security code: allowed for ' + member.id);
        }
        else if (securityCode) {
           await this.checkSecurityCode(member, securityCode);
        }
        else {
            if (type === 'patch') {
                throw Context.auth.memberNotFoundOrNoAccess();
            }

            throw new SimpleError({
                code: 'known_member_missing_rights',
                message: 'Creating known member without sufficient access rights',
                human: $t(`%1BA`, { member: member.details.firstName }),
                statusCode: 400,
            });
        }
    }

    static shouldCheckIfMemberIsDuplicate(put: Member): boolean {
        if (put.details.firstName === '???') {
            return false;
        }

        if (put.details.name.length <= 3) {
            return false;
        }

        const age = put.details.age;
        // do not check if member is duplicate for historical members
        return age !== null && age < 81;
    }

    static async checkDuplicate(member: Member, securityCode: string | null | undefined, type: 'put' | 'patch') {
        if (!this.shouldCheckIfMemberIsDuplicate(member)) {
            return;
        }

        // Check for duplicates and prevent creating a duplicate member by a user
        const duplicate = await this.findExistingMember(member);
        if (duplicate) {
            console.error('duplicate detection');
            console.error(member.details.parents);
            console.error(duplicate.details.parents);

            await this.checkCanAccessMember(duplicate, securityCode, type);

            // Merge data
            // NOTE: We use mergeTwoMembers instead of mergeMultipleMembers, because we should never safe 'member' , because that one does not exist in the database
            await mergeTwoMembers(duplicate, member);
            return duplicate;
        }
    }

    async createDummyMembers(organization: Organization, count: number) {
        await new MemberFactory({
            organization,
        }).createMultiple(count);
    }

    async checkResponsbilityLimits(model: MemberResponsibilityRecord, responsibility: MemberResponsibility) {
        if (responsibility.maximumMembers !== null) {
            if (!model.getBaseStructure().isActive) {
                return;
            }

            const query = MemberResponsibilityRecord.select()
                .where('responsibilityId', responsibility.id)
                .andWhere('organizationId', model.organizationId)
                .andWhere('groupId', model.groupId)
                .andWhere(MemberResponsibilityRecord.whereActive);

            if (model.existsInDatabase) {
                query.andWhere('id', '!=', model.id);
            }

            const count = (await query.count()) + 1;

            // Because it should be possible to move around responsibilities, we allow 1 extra
            const actualLimit = responsibility.maximumMembers <= 1 ? 2 : responsibility.maximumMembers;

            if (count > actualLimit) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Maximum members reached',
                    human: responsibility.maximumMembers === 1
                        ? (model.groupId
                                ? $t('%C5', { responsibility: responsibility.name })
                                : $t('%C6', { responsibility: responsibility.name }))
                        : (model.groupId
                                ? $t('%C7', { count: responsibility.maximumMembers.toFixed(), responsibility: responsibility.name })
                                : $t('%C8', { count: responsibility.maximumMembers.toFixed(), responsibility: responsibility.name })),
                });
            }
        }
    }
}
