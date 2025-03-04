import { OneToManyRelation } from '@simonbackx/simple-database';
import { AutoEncoderPatchType, ConvertArrayToPatchableArray, Decoder, isEmptyPatch, isPatchableArray, PatchableArray, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { AuditLog, BalanceItem, Document, Group, Member, MemberFactory, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithRegistrations, mergeTwoMembers, Organization, Platform, RateLimiter, Registration, RegistrationPeriod, User } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType, EmergencyContact, GroupType, MemberDetails, MemberResponsibility, MembersBlob, MemberWithRegistrationsBlob, Parent, PermissionLevel } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Email } from '@stamhoofd/email';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { MembershipCharger } from '../../../helpers/MembershipCharger';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer';
import { SetupStepUpdater } from '../../../helpers/SetupStepUpdater';
import { PlatformMembershipService } from '../../../services/PlatformMembershipService';
import { RegistrationService } from '../../../services/RegistrationService';
import { shouldCheckIfMemberIsDuplicateForPatch } from './shouldCheckIfMemberIsDuplicate';

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

        const members: MemberWithRegistrations[] = [];

        const platform = await Platform.getShared();

        // Cache
        const groups: Group[] = [];

        async function getGroup(id: string) {
            const f = groups.find(g => g.id === id);
            if (f) {
                return f;
            }
            const group = await Group.getByID(id);
            if (group) {
                groups.push(group);
                return group;
            }
            return null;
        }

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

            struct.details.cleanData();
            member.details = struct.details;

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, struct.details.securityCode, 'put');
            if (duplicate) {
                // Merge data
                member = duplicate;
            }

            // We risk creating a new member without being able to access it manually afterwards
            // Cache access to this member temporarily in memory
            await Context.auth.temporarilyGrantMemberAccess(member, PermissionLevel.Write);

            if (STAMHOOFD.userMode !== 'platform' && !member.organizationId) {
                throw new SimpleError({
                    code: 'missing_organization',
                    message: 'Missing organization',
                    human: 'Je moet een organisatie selecteren voor dit lid',
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

            await member.save();
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

            if (!(await Context.auth.canAccessMember(member, PermissionLevel.Write))) {
                await PatchOrganizationMembersEndpoint.checkSecurityCode(member, securityCode, 'patch');
            }

            patch = await Context.auth.filterMemberPatch(member, patch);
            const originalDetails = member.details.clone();

            let shouldCheckDuplicate = false;

            if (patch.details) {
                if (patch.details.isPut()) {
                    throw new SimpleError({
                        code: 'not_allowed',
                        message: 'Cannot override details',
                        human: 'Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.',
                        field: 'details',
                    });
                }

                shouldCheckDuplicate = shouldCheckIfMemberIsDuplicateForPatch(patch, originalDetails);

                const wasReduced = member.details.shouldApplyReducedPrice;
                member.details.patchOrPut(patch.details);
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

            await member.save();

            // If parents changed or emergeny contacts: fetch family and merge data
            if (patch.details && (!isEmptyPatch(patch.details?.parents) || !isEmptyPatch(patch.details?.emergencyContacts))) {
                await PatchOrganizationMembersEndpoint.mergeDuplicateRelations(member, patch.details);
            }

            // Update documents
            await Document.updateForMember(member.id);

            // Update responsibilities
            for (const patchResponsibility of patch.responsibilities.getPatches()) {
                if (!Context.auth.hasPlatformFullAccess() && !(organization && await Context.auth.hasFullAccess(organization.id))) {
                    throw Context.auth.error('Je hebt niet voldoende rechten om functies van leden aan te passen');
                }

                const responsibilityRecord = await MemberResponsibilityRecord.getByID(patchResponsibility.id);
                if (!responsibilityRecord || responsibilityRecord.memberId !== member.id || (organization && responsibilityRecord.organizationId !== organization.id)) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: "You don't have permissions to access this endpoint",
                        human: 'Je hebt geen toegang om deze functie te wijzigen',
                    });
                }

                const responsibility = platform.config.responsibilities.find(r => r.id === patchResponsibility.responsibilityId);

                if (responsibility && !responsibility.organizationBased && !Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error('Je hebt niet voldoende rechten om deze functie aan te passen');
                }

                // Allow patching begin and end date
                if (patchResponsibility.endDate !== undefined) {
                    if (responsibilityRecord.endDate) {
                        if (!Context.auth.hasPlatformFullAccess()) {
                            throw Context.auth.error('Je hebt niet voldoende rechten om reeds beëindigde functies aan te passen');
                        }
                    }
                    responsibilityRecord.endDate = patchResponsibility.endDate;
                }

                if (patchResponsibility.startDate !== undefined) {
                    if (patchResponsibility.startDate.getTime() > Date.now() + 5 * 60 * 1000) {
                        throw Context.auth.error('Je kan de startdatum van een functie niet in de toekomst zetten');
                    }
                    if (patchResponsibility.startDate.getTime() > Date.now()) {
                        patchResponsibility.startDate = new Date(); // force now
                    }

                    const daysDiff = Math.abs((new Date().getTime() - patchResponsibility.startDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysDiff > 60 && !Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error('Je kan de startdatum van een functie niet zoveel verplaatsen');
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
                    throw Context.auth.error('Je hebt niet voldoende rechten om functies van leden aan te passen');
                }

                const platformResponsibility = platform.config.responsibilities.find(r => r.id === put.responsibilityId);
                const org = organization ?? (put.organizationId ? await Organization.getByID(put.organizationId) : null);

                if (!org && put.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: 'Deze vereniging bestaat niet',
                        field: 'organizationId',
                    });
                }
                const responsibility = platformResponsibility ?? org?.privateMeta.responsibilities.find(r => r.id === put.responsibilityId);

                if (!responsibility) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid responsibility',
                        human: 'Deze functie bestaat niet',
                        field: 'responsibilityId',
                    });
                }

                if (!org && responsibility.organizationBased) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: 'Deze functie kan niet worden toegewezen aan deze vereniging',
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
                        if (registration.periodId !== platform.periodId) {
                            return false;
                        }
                    }
                    return registration.deactivatedAt === null && registration.registeredAt !== null && registration.group.type === GroupType.Membership;
                });

                if (!hasRegistration) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: Context.i18n.$t('d41cdbe3-57e3-4a2e-83bc-cb9e65c9c840'),
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
                        human: 'Deze functie is niet beschikbaar voor deze vereniging',
                        field: 'organizationId',
                    });
                }

                if (responsibility.defaultAgeGroupIds !== null) {
                    if (!put.groupId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Missing groupId',
                            human: 'Kies een leeftijdsgroep waarvoor je deze functie wilt toekennen',
                            field: 'groupId',
                        });
                    }

                    const group = await Group.getByID(put.groupId);
                    if (!group || group.organizationId !== model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid groupId',
                            human: 'Deze leeftijdsgroep bestaat niet',
                            field: 'groupId',
                        });
                    }

                    if (group.defaultAgeGroupId === null || !responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid groupId',
                            human: 'Deze leeftijdsgroep komt niet in aanmerking voor deze functie',
                            field: 'groupId',
                        });
                    }

                    model.groupId = group.id;
                }

                // Allow patching begin and end date
                model.endDate = put.endDate;

                if (put.startDate.getTime() > Date.now() + 5 * 60 * 1000) {
                    throw Context.auth.error('Je kan de startdatum van een functie niet in de toekomst zetten');
                }

                if (put.startDate.getTime() > Date.now()) {
                    put.startDate = new Date(); // force now
                }

                if (put.endDate && put.endDate > new Date(Date.now() + 60 * 1000)) {
                    throw Context.auth.error('Je kan de einddatum van een functie niet in de toekomst zetten - kijk indien nodig je systeemtijd na');
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
                        human: 'Je kan een account niet de toegang ontzeggen tot een lid als het e-mailadres nog steeds is opgeslagen als onderdeel van de gegevens van dat lid. Verwijder eerst het e-mailadres uit de gegevens van het lid en ontkoppel daarna het account.',
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
                            human: Context.i18n.$t(`62103514-05f5-4dc0-a5cc-c9321f21c63d`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`745f5355-3398-406d-842e-5c9f7a700e91`, { period: period?.getBaseStructure().name }),
                            field: 'periodId',
                        });
                    }
                }

                if (organization && put.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid organization',
                        human: 'Je kan geen aansluitingen maken voor een andere vereniging',
                        field: 'organizationId',
                    });
                }

                if (!await Context.auth.hasFullAccess(put.organizationId)) {
                    throw Context.auth.error('Je hebt niet voldoende rechten om deze aansluiting toe te voegen');
                }

                const putForOrganization = await Context.auth.getOrganization(put.organizationId);

                const membershipType = platform.config.membershipTypes.find(t => t.id === put.membershipTypeId);

                if (!membershipType) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'membershipTypeId',
                        message: 'Invalid membership type',
                        human: 'Dit aansluitingstype bestaat niet',
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
                        human: 'Dit aansluitingstype is niet toegestaan voor dit lid',
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

                if (existing) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'startDate',
                        message: 'Invalid start date',
                        human: 'Je kan geen aansluiting toevoegen die overlapt met een bestaande aansluiting van hetzelfde type',
                    });
                }

                // Save if okay
                await membership.save();

                updateMembershipMemberIds.add(member.id);
            }

            for (const p of patch.platformMemberships.getPatches()) {
                const membership = await MemberPlatformMembership.getByID(p.id);

                if (!membership || membership.memberId !== member.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'id',
                        message: 'Invalid id',
                        human: 'Deze aansluiting bestaat niet',
                    });
                }

                if (!await Context.auth.hasFullAccess(membership.organizationId)) {
                    throw Context.auth.error('Je hebt niet voldoende rechten om deze aansluiting aan te passen');
                }

                if (membership.periodId !== platform.periodId) {
                    const period = await RegistrationPeriod.getByID(membership.periodId);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: $t(`82af2364-c711-4e44-a871-9346c2cab66a`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: $t(`92a41b40-9841-4326-abaf-a8a7d97e5d55`),
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
                        throw Context.auth.error($t('bbc639c8-abdb-42d8-b5ed-f58084886ad9'));
                    }

                    if (p.locked === false) {
                        throw Context.auth.error($t('c6494677-86f0-4d2e-b9ac-bedfc9e87187'));
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
                        human: 'Deze aansluiting bestaat niet',
                    });
                }

                if (!await Context.auth.hasFullAccess(membership.organizationId)) {
                    throw Context.auth.error('Je hebt niet voldoende rechten om deze aansluiting te verwijderen');
                }

                if (membership.periodId !== platform.periodId) {
                    const period = await RegistrationPeriod.getByID(membership.periodId);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`1f1d657d-bc73-4cae-9025-b3ec67a705e7`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`2e615670-813a-414f-b06c-f76136891bf8`, { period: period?.getBaseStructure().name }),
                            field: 'periodId',
                        });
                    }
                }

                if (!membership.canDelete(Context.auth.hasPlatformFullAccess())) {
                    if (membership.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid invoice',
                            human: 'Je kan geen aansluiting verwijderen die vergrendeld is',
                        });
                    }

                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid invoice',
                        human: 'Je kan geen aansluiting verwijderen die al werd gefactureerd',
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
            SetupStepUpdater.updateForOrganization(organization).catch(console.error);
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(members),
        );
    }

    static async deleteMembers(ids: string[]) {
        const updateGroups = new Set<string>();
        const updateRegistrations = new Map<string, Registration>();
        const updateSteps = new Set<string>();

        // Loop all members one by one
        for (const id of ids) {
            const member = await Member.getWithRegistrations(id);
            if (!member || !await Context.auth.canDeleteMember(member)) {
                throw Context.auth.error('Je hebt niet voldoende rechten om dit lid te verwijderen');
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

    static async mergeDuplicateRelations(member: MemberWithRegistrations, patch: AutoEncoderPatchType<MemberDetails> | MemberDetails) {
        const _familyMembers = await Member.getFamilyWithRegistrations(member.id);
        const familyMembers: typeof _familyMembers = [];
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
                    await Document.updateForMember(m.id);
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

    static async checkSecurityCode(member: MemberWithRegistrations, securityCode: string | null | undefined, type: 'put' | 'patch') {
        if ((type === 'put' && await member.isSafeToMergeDuplicateWithoutSecurityCode()) || await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
            console.log('checkSecurityCode: without security code: allowed for ' + member.id);
        }
        else if (securityCode) {
            try {
                securityCodeLimiter.track(member.details.name, 1);
            }
            catch (e) {
                Email.sendWebmaster({
                    subject: '[Limiet] Limiet bereikt voor aantal beveiligingscodes',
                    text: 'Beste, \nDe limiet werd bereikt voor het aantal beveiligingscodes per dag. \nNaam lid: ' + member.details.name + ' (ID: ' + member.id + ')' + '\n\n' + e.message + '\n\nStamhoofd',
                });

                throw new SimpleError({
                    code: 'too_many_tries',
                    message: 'Too many securityCodes limited',
                    human: 'Oeps! Om spam te voorkomen limiteren we het aantal beveiligingscodes die je kan proberen. Probeer morgen opnieuw.',
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
                        human: Context.i18n.$t('49753d6a-7ca4-4145-8024-0be05a9ab063'),
                        statusCode: 400,
                    });
                }
            }

            console.log('checkSecurityCode: security code is correct - for ' + member.id);

            // Grant temporary access to this member without needing to enter the security code again
            await Context.auth.temporarilyGrantMemberAccess(member, PermissionLevel.Write);

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
        else {
            if (type === 'patch') {
                throw Context.auth.memberNotFoundOrNoAccess();
            }
            throw new SimpleError({
                code: 'known_member_missing_rights',
                message: 'Creating known member without sufficient access rights',
                human: `${member.details.firstName} is al gekend in ons systeem, maar jouw e-mailadres niet. Om toegang te krijgen heb je de beveiligingscode nodig.`,
                statusCode: 400,
            });
        }
    }

    static shouldCheckIfMemberIsDuplicate(put: Member): boolean {
        if (put.details.firstName.length <= 3 && put.details.lastName.length <= 3) {
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
            await this.checkSecurityCode(duplicate, securityCode, type);

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
                                ? $t('Je kan maar één lid hebben met de functie {responsibility} in deze leeftijdsgroep', { responsibility: responsibility.name })
                                : $t('Je kan maar één lid hebben met de functie {responsibility}', { responsibility: responsibility.name }))
                        : (model.groupId
                                ? $t('Je kan maximum {count} leden hebben met de functie {responsibility} in deze leeftijdsgroep', { count: responsibility.maximumMembers.toFixed(), responsibility: responsibility.name })
                                : $t('Je kan maximum {count} leden hebben met de functie {responsibility}', { count: responsibility.maximumMembers.toFixed(), responsibility: responsibility.name })),
                });
            }
        }
    }
}
