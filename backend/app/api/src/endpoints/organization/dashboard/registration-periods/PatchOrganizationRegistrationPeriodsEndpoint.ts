import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { GroupPrivateSettings, Group as GroupStruct, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PermissionLevel, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';

import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Organization, OrganizationRegistrationPeriod, Platform, RegistrationPeriod, SetupStepUpdater } from '@stamhoofd/models';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
type ResponseBody = OrganizationRegistrationPeriodStruct[];

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(OrganizationRegistrationPeriodStruct as Decoder<OrganizationRegistrationPeriodStruct>, OrganizationRegistrationPeriodStruct.patchType() as Decoder<AutoEncoderPatchType<OrganizationRegistrationPeriodStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/registration-periods', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        const periods: OrganizationRegistrationPeriod[] = [];

        for (const { put } of request.body.getPuts()) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
            periods.push(await PatchOrganizationRegistrationPeriodsEndpoint.createOrganizationPeriod(organization, put));
        }

        for (const patch of request.body.getPatches()) {
            const organizationPeriod = await OrganizationRegistrationPeriod.getByID(patch.id);
            if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    statusCode: 404,
                });
            }

            const period = await RegistrationPeriod.getByID(organizationPeriod.periodId);

            if (!period) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    statusCode: 404,
                });
            }

            if (period.locked) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    human: 'Je kan geen wijzigingen meer aanbrengen in ' + period.getStructure().name + ' omdat deze is afgesloten',
                    statusCode: 404,
                });
            }

            let deleteUnreachable = false;
            const allowedIds: string[] = [];
            let wasInvalid = false;

            // Check if have an initial invalid state
            if (patch.settings) {
                // Already clean up the categories (not yet delete the groups)
                const groups = await Group.getAll(organization.id, organizationPeriod.periodId);
                await organizationPeriod.cleanCategories(groups);

                for (const category of organizationPeriod.settings.categories) {
                    if (category.groupIds.length && category.categoryIds.length) {
                        wasInvalid = true;
                    }
                }
            }

            // #region prevent patch category lock if no full platform access
            const originalCategories = organizationPeriod.settings.categories;

            if (await Context.auth.hasFullAccess(organization.id)) {
                if (patch.settings) {
                    if (patch.settings.categories) {
                        deleteUnreachable = true;
                    }
                    organizationPeriod.settings = organizationPeriod.settings.patch(patch.settings);
                }
            }
            else {
                /// Only allow editing category group ids
                if (patch.settings) {
                    // Only allow adding groups if we have create permissions in a given category group
                    if (patch.settings.categories && !Array.isArray(patch.settings.categories)) {
                        for (const pp of patch.settings.categories.getPatches()) {
                            const category = organizationPeriod.settings.categories.find(c => c.id === pp.id);
                            if (!category) {
                                // Fail silently
                                continue;
                            }

                            if (!await Context.auth.canCreateGroupInCategory(organization.id, category)) {
                                throw Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen in deze categorie');
                            }

                            // Only process puts
                            const ids = pp.groupIds.getPuts().map(p => p.put);
                            allowedIds.push(...ids);
                            category.groupIds.push(...ids);
                        }

                        if (allowedIds.length > 0) {
                            deleteUnreachable = true;
                        }
                    }
                }
            }

            // Check if we have a category with groups and categories combined
            if (patch.settings && !wasInvalid) {
                for (const category of organizationPeriod.settings.categories) {
                    if (category.groupIds.length && category.categoryIds.length) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'categories',
                            message: 'Cannot have groups and categories combined',
                            human: 'Een categorie kan niet zowel groepen als subcategorieën bevatten. Mogelijks zijn meerdere mensen tegelijk aanpassingen aan het maken aan de categorieën. Herlaadt de pagina en probeer opnieuw.',
                        });
                    }
                }
            }

            // #region handle locked categories
            if (!Context.auth.hasPlatformFullAccess()) {
                const categoriesAfterPatch = organizationPeriod.settings.categories;

                for (const categoryBefore of originalCategories) {
                    const locked = categoryBefore.settings.locked;

                    if (locked) {
                        // todo: use existing function, now a category could still be deleted if the category is moved to another category and that catetory is deleted
                        const categoryId = categoryBefore.id;
                        const refCountBefore = originalCategories.filter(c => c.categoryIds.includes(categoryId)).length;
                        const refCountAfter = categoriesAfterPatch.filter(c => c.categoryIds.includes(categoryId)).length;
                        const isDeleted = refCountAfter < refCountBefore;

                        if (isDeleted) {
                            throw Context.auth.error('Je hebt geen toegangsrechten om deze vergrendelde categorie te verwijderen.');
                        }
                    }

                    const categoryAfter = categoriesAfterPatch.find(c => c.id === categoryBefore.id);

                    if (!categoryAfter) {
                        if (locked) {
                            throw Context.auth.error('Je hebt geen toegangsrechten om deze vergrendelde categorie te verwijderen.');
                        }
                    }
                    else if (locked !== categoryAfter.settings.locked) {
                        throw Context.auth.error('Je hebt geen toegangsrechten om deze categorie te vergrendelen of ontgrendelen.');
                    }

                    if (!locked || !categoryAfter) {
                        continue;
                    }

                    const settingsBefore = categoryBefore.settings;
                    const settingsAfter = categoryAfter.settings;

                    if (settingsBefore.name !== settingsAfter.name) {
                        throw Context.auth.error('Je hebt geen toegangsrechten de naam van deze vergrendelde categorie te wijzigen.');
                    }
                }
            }
            // #endregion

            await organizationPeriod.save();
            let shouldUpdateSetupSteps = false;

            // Check changes to groups
            const deleteGroups = patch.groups.getDeletes();
            if (deleteGroups.length > 0) {
                shouldUpdateSetupSteps = true;
                for (const id of deleteGroups) {
                    await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(id);
                    deleteUnreachable = true;
                }
            }

            for (const groupPut of patch.groups.getPuts()) {
                shouldUpdateSetupSteps = true;
                await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(groupPut.put, organization.id, period, { allowedIds });
                deleteUnreachable = true;
            }

            for (const struct of patch.groups.getPatches()) {
                await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(struct, period);
            }

            if (deleteUnreachable) {
                const groups = await Group.getAll(organization.id, organizationPeriod.periodId);

                // Delete unreachable categories first
                await organizationPeriod.cleanCategories(groups);
                await Group.deleteUnreachable(organization.id, organizationPeriod, groups);
            }

            if (shouldUpdateSetupSteps) {
                SetupStepUpdater.updateForOrganization(organization).catch(console.error);
            }

            periods.push(organizationPeriod);
        }

        return new Response(
            await AuthenticatedStructures.organizationRegistrationPeriods(periods),
        );
    }

    static async validateDefaultGroupId(id: string | null): Promise<string | null> {
        if (id === null) {
            return id;
        }
        const platform = await Platform.getSharedStruct();

        if (platform.config.defaultAgeGroups.find(g => g.id === id)) {
            return id;
        }

        throw new SimpleError({
            code: 'invalid_default_age_group',
            message: 'Invalid default age group',
            human: 'De standaard leeftijdsgroep is ongeldig',
            statusCode: 400,
        });
    }

    static async createOrganizationPeriod(organization: Organization, struct: OrganizationRegistrationPeriodStruct) {
        const period = await RegistrationPeriod.getByID(struct.period.id);

        if (!period || period.locked) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                statusCode: 404,
            });
        }

        const organizationPeriod = new OrganizationRegistrationPeriod();
        organizationPeriod.id = struct.id;
        organizationPeriod.organizationId = organization.id;
        organizationPeriod.periodId = struct.period.id;
        organizationPeriod.settings = struct.settings;
        await organizationPeriod.save();

        for (const s of struct.groups) {
            s.settings.registeredMembers = 0;
            s.settings.reservedMembers = 0;
            await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(s, organization.id, period);
        }
        const groups = await Group.getAll(organization.id, organizationPeriod.periodId);

        // Delete unreachable categories first
        await organizationPeriod.cleanCategories(groups);
        await Group.deleteUnreachable(organization.id, organizationPeriod, groups);

        return organizationPeriod;
    }

    static async deleteGroup(id: string) {
        const model = await Group.getByID(id);
        if (!model || !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            throw Context.auth.error('Je hebt geen toegangsrechten om deze groep te verwijderen');
        }

        model.deletedAt = new Date();
        await model.save();
    }

    static async patchGroup(struct: AutoEncoderPatchType<GroupStruct>, period?: RegistrationPeriod | null) {
        const model = await Group.getByID(struct.id);

        if (!model || !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            throw Context.auth.error('Je hebt geen toegangsrechten om deze groep te wijzigen');
        }

        const previousProperties = {
            deletedAt: model.deletedAt,
            defaultAgeGroupId: model.defaultAgeGroupId,
        };

        if (struct.settings) {
            struct.settings.period = undefined; // Not allowed to patch manually
            model.settings.patchOrPut(struct.settings);
        }

        if (struct.status) {
            model.status = struct.status;
        }

        if (struct.privateSettings) {
            model.privateSettings.patchOrPut(struct.privateSettings);

            if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'missing_permissions',
                    message: 'You cannot restrict your own permissions',
                    human: 'Je kan je eigen volledige toegang tot deze inschrijvingsgroep niet verwijderen. Vraag aan een hoofdbeheerder om jouw toegang te verwijderen.',
                });
            }
        }

        if (struct.cycle !== undefined) {
            model.cycle = struct.cycle;
        }

        if (struct.deletedAt !== undefined) {
            model.deletedAt = struct.deletedAt;
        }

        if (struct.defaultAgeGroupId !== undefined) {
            model.defaultAgeGroupId = await this.validateDefaultGroupId(struct.defaultAgeGroupId);
        }

        if (!period && !model.settings.period) {
            period = await RegistrationPeriod.getByID(model.periodId);
        }

        if (period) {
            model.periodId = period.id;
            model.settings.period = period.getBaseStructure();

            if (model.type !== GroupType.EventRegistration) {
                model.settings.startDate = period.startDate;
                model.settings.endDate = period.endDate;
            }
        }

        const patch = struct;
        if (patch.waitingList !== undefined) {
            if (patch.waitingList === null) {
                // delete
                if (model.waitingListId) {
                    // for now don't delete, as waiting lists can be shared between multiple groups
                    // await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(model.waitingListId)
                    model.waitingListId = null;
                }
            }
            else if (patch.waitingList.isPatch()) {
                if (!model.waitingListId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'waitingList',
                        message: 'Cannot patch waiting list before it is created',
                    });
                }
                patch.waitingList.id = model.waitingListId;
                patch.waitingList.type = GroupType.WaitingList;
                await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(patch.waitingList, period);
            }
            else {
                if (model.waitingListId) {
                    // for now don't delete, as waiting lists can be shared between multiple groups
                    // await PatchOrganizationRegistrationPeriodsEndpoint.deleteGroup(model.waitingListId)
                    model.waitingListId = null;
                }
                patch.waitingList.type = GroupType.WaitingList;

                const existing = await Group.getByID(patch.waitingList.id);
                if (existing) {
                    if (existing.organizationId !== model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'waitingList',
                            message: 'Waiting list group is already used in another organization',
                        });
                    }

                    if (existing.periodId !== model.periodId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            field: 'waitingList',
                            message: 'Waiting list group is already used in another period',
                            human: 'Een wachtlijst kan momenteel niet gedeeld worden tussen verschillende werkjaren',
                        });
                    }

                    model.waitingListId = existing.id;
                }
                else {
                    const requiredPeriod = period ?? await RegistrationPeriod.getByID(model.periodId);

                    if (!requiredPeriod) {
                        throw new Error('Unexpected missing period when creating waiting list');
                    }
                    const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                        patch.waitingList,
                        model.organizationId,
                        requiredPeriod,
                    );
                    model.waitingListId = group.id;
                }
            }
        }

        await model.updateOccupancy({
            previousProperties,
        });
        await model.save();
    }

    static async createGroup(struct: GroupStruct, organizationId: string, period: RegistrationPeriod, options?: { allowedIds?: string[] }): Promise<Group> {
        const allowedIds = options?.allowedIds ?? [];

        if (!await Context.auth.hasFullAccess(organizationId)) {
            if (allowedIds.includes(struct.id)) {
                // Ok
            }
            else {
                throw Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen');
            }
        }

        const user = Context.auth.user;

        const model = new Group();
        model.id = struct.id;
        model.organizationId = organizationId;
        model.defaultAgeGroupId = await this.validateDefaultGroupId(struct.defaultAgeGroupId);
        model.periodId = period.id;
        model.settings = struct.settings;
        model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({});
        model.status = struct.status;
        model.type = struct.type;
        model.settings.period = period.getBaseStructure();
        model.settings.startDate = period.startDate;
        model.settings.endDate = period.endDate;

        if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            // Create a temporary permission role for this user
            const organizationPermissions = user.permissions?.organizationPermissions?.get(organizationId);
            if (!organizationPermissions) {
                throw new Error('Unexpected missing permissions');
            }
            const resourcePermissions = ResourcePermissions.create({
                resourceName: model.settings.name,
                level: PermissionLevel.Full,
            });
            const patch = resourcePermissions.createInsertPatch(PermissionsResourceType.Groups, model.id, organizationPermissions);
            user.permissions!.organizationPermissions.set(organizationId, organizationPermissions.patch(patch));
            console.log('Automatically granted author full permissions to resource', 'group', model.id, 'user', user.id, 'patch', patch.encode({ version: Version }));
            await user.save();
        }

        // Check if current user has permissions to this new group -> else fail with error
        if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            throw new SimpleError({
                code: 'missing_permissions',
                message: 'You cannot restrict your own permissions',
                human: 'Je kan geen inschrijvingsgroep maken zonder dat je zelf volledige toegang hebt tot de nieuwe groep',
            });
        }

        if (struct.waitingList) {
            const existing = await Group.getByID(struct.waitingList.id);
            if (existing) {
                if (existing.organizationId !== model.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'waitingList',
                        message: 'Waiting list group is already used in another organization',
                    });
                }

                model.waitingListId = existing.id;
            }
            else {
                struct.waitingList.type = GroupType.WaitingList;
                const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                    struct.waitingList,
                    model.organizationId,
                    period,
                );
                model.waitingListId = group.id;
            }
        }

        await model.save();
        await model.updateOccupancy({ isNew: true }); // Force update steps

        return model;
    }
}
