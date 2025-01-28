import { OneToManyRelation } from '@simonbackx/simple-database';
import { ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Document, Group, Member, MemberFactory, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithRegistrations, mergeTwoMembers, Organization, Platform, RateLimiter, Registration, RegistrationPeriod, User } from '@stamhoofd/models';
import { GroupType, MembersBlob, MemberWithRegistrationsBlob, PermissionLevel } from '@stamhoofd/structures';
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

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, struct.details.securityCode);
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
                throw Context.auth.notFoundOrNoAccess('Je hebt geen toegang tot dit lid of het bestaat niet');
            }

            if (!await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
                // Still allowed if you provide a security code
                await PatchOrganizationMembersEndpoint.checkSecurityCode(member, securityCode);
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

                if (
                    // has long name
                    (
                        // has long first name
                        ((patch.details.firstName !== undefined && patch.details.firstName.length > 3) || (patch.details.firstName === undefined && originalDetails.firstName.length > 3))
                        // or has long last name
                        || ((patch.details.lastName !== undefined && patch.details.lastName.length > 3) || (patch.details.lastName === undefined && originalDetails.lastName.length > 3))
                    )
                    // has name change or birthday change
                    && (
                        // has first name change
                        (patch.details.firstName !== undefined && patch.details.firstName !== originalDetails.firstName)
                        // has last name change
                        || (patch.details.lastName !== undefined && patch.details.lastName !== originalDetails.lastName)
                        // has birth day change
                        || (patch.details.birthDay !== undefined && patch.details.birthDay?.getTime() !== originalDetails.birthDay?.getTime())
                    )
                ) {
                    shouldCheckDuplicate = true;
                }

                const wasReduced = member.details.shouldApplyReducedPrice;
                member.details.patchOrPut(patch.details);
                member.details.cleanData();

                if (wasReduced !== member.details.shouldApplyReducedPrice) {
                    updateMembershipMemberIds.add(member.id);
                }
            }

            if (shouldCheckDuplicate) {
                const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member, securityCode);

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
                            human: Context.i18n.$t(`Je kan geen aansluitingen meer toevoegen in dit werkjaar`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`Je kan geen aansluitingen meer toevoegen in {period} (vergrendeld)`, { period: period?.getBaseStructure().name }),
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

                // Check duplicate memberships
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

                const membership = new MemberPlatformMembership();
                membership.id = put.id;
                membership.memberId = member.id;
                membership.membershipTypeId = put.membershipTypeId;
                membership.organizationId = put.organizationId;
                membership.periodId = put.periodId;

                membership.startDate = new Date(Math.max(Date.now(), put.startDate.getTime()));
                membership.endDate = put.endDate;
                membership.expireDate = put.expireDate;

                await membership.calculatePrice(member);
                await membership.save();

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
                            human: Context.i18n.$t(`Je kan geen aansluitingen meer verwijderen in dit werkjaar`),
                            field: 'periodId',
                        });
                    }

                    if (period?.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid period',
                            human: Context.i18n.$t(`Je kan geen aansluitingen meer verwijderen in {period} (vergrendeld)`, { period: period?.getBaseStructure().name }),
                            field: 'periodId',
                        });
                    }
                }

                if (!membership.canDelete() && !Context.auth.hasPlatformFullAccess()) {
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
            QueueHandler.schedule('update-membership-prices', async () => {
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

    static async checkSecurityCode(member: MemberWithRegistrations, securityCode: string | null | undefined) {
        if (await member.isSafeToMergeDuplicateWithoutSecurityCode() || await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
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
        }
        else {
            throw new SimpleError({
                code: 'known_member_missing_rights',
                message: 'Creating known member without sufficient access rights',
                human: `${member.details.firstName} is al gekend in ons systeem, maar jouw e-mailadres niet. Om toegang te krijgen heb je de beveiligingscode nodig.`,
                statusCode: 400,
            });
        }
    }

    static async checkDuplicate(member: Member, securityCode: string | null | undefined) {
        // Check for duplicates and prevent creating a duplicate member by a user
        const duplicate = await this.findExistingMember(member);
        if (duplicate) {
            await this.checkSecurityCode(duplicate, securityCode);

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
}
