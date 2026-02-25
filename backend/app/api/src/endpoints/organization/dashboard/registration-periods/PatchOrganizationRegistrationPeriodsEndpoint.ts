import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { GroupPrivateSettings, Group as GroupStruct, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PermissionLevel, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';

import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Event, Group, Organization, OrganizationRegistrationPeriod, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { SetupStepUpdater } from '../../../../helpers/SetupStepUpdater.js';

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

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const periods: OrganizationRegistrationPeriod[] = [];

        for (const { put } of request.body.getPuts()) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
            periods.push(await PatchOrganizationRegistrationPeriodsEndpoint.createOrganizationPeriod(organization, put));
        }

        const forceGroupIds: string[] = [];

        for (const patch of request.body.getPatches()) {
            const organizationPeriod = await OrganizationRegistrationPeriod.getByID(patch.id);

            if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    human: $t('347463a0-1e9a-40fe-996c-d77ba13bc05b'),
                    statusCode: 404,
                });
            }

            const period = await RegistrationPeriod.getByID(organizationPeriod.periodId);

            if (!period || (STAMHOOFD.userMode === 'organization' && period.organizationId !== organization.id)) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    human: $t('347463a0-1e9a-40fe-996c-d77ba13bc05b'),
                    statusCode: 404,
                });
            }

            if ((!period.organizationId && period.locked) || (period.locked && period.organizationId && !await Context.auth.hasFullAccess(period.organizationId))) {
                throw new SimpleError({
                    code: 'locked_period',
                    message: 'This period is locked',
                    human: $t(`cc658db0-ee90-40fc-8a8c-1074a4f1f2f2`, { '2000-2001': period.getStructure().nameShort }),
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
                                throw Context.auth.error($t(`cdee3a74-4c03-46bc-ade1-7b8275a85400`));
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
                            human: $t(`c3834052-ea84-4d95-bc67-194e233cb11a`),
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
                            throw Context.auth.error($t(`55ddf8ff-ffcf-4577-bcbf-78c82637f245`));
                        }
                    }

                    const categoryAfter = categoriesAfterPatch.find(c => c.id === categoryBefore.id);

                    if (!categoryAfter) {
                        if (locked) {
                            throw Context.auth.error($t(`55ddf8ff-ffcf-4577-bcbf-78c82637f245`));
                        }
                    }
                    else if (locked !== categoryAfter.settings.locked) {
                        throw Context.auth.error($t(`a8982f4f-0c87-4f22-8f43-33ca26b73fc4`));
                    }

                    if (!locked || !categoryAfter) {
                        continue;
                    }

                    const settingsBefore = categoryBefore.settings;
                    const settingsAfter = categoryAfter.settings;

                    if (settingsBefore.name !== settingsAfter.name) {
                        throw Context.auth.error($t(`2529c09e-f582-486a-b3eb-a8b96d8efa26`));
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
                groupPut.put.settings.throwIfInvalidPrices();
                if (groupPut.put.type === GroupType.EventRegistration) {
                    throw new SimpleError({
                        code: 'invalid_group_type',
                        message: 'Cannot create groups for events via this endpoint',
                        human: $t(`40dde58e-47fb-4adb-971a-537b16c479d5`),
                    });
                }

                const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(groupPut.put, organization.id, period, { allowedIds });
                deleteUnreachable = true;
                forceGroupIds.push(group.id);
            }

            for (const struct of patch.groups.getPatches()) {
                const group = await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(struct, period);
                forceGroupIds.push(group.id);
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
            await AuthenticatedStructures.organizationRegistrationPeriods(periods, undefined, { forceGroupIds }),
        );
    }

    static async validateDefaultGroupId(id: string | null): Promise<string | null> {
        if (id === null) {
            return id;
        }
        const platform = await Platform.getSharedStruct();

        const defaultAgeGroup = platform.config.defaultAgeGroups.find(g => g.id === id);

        if (defaultAgeGroup) {
            const organization = Context.organization;
            const tags = organization?.meta.tags ?? [];

            if (defaultAgeGroup.isEnabledForTags(tags)) {
                return id;
            }

            throw new SimpleError({
                code: 'invalid_default_age_group',
                message: 'Invalid default age group',
                human: $t(`d81fc0f4-14e5-499c-9749-dd8941cdeb45`),
                statusCode: 400,
            });
        }

        throw new SimpleError({
            code: 'invalid_default_age_group',
            message: 'Invalid default age group',
            human: $t(`79672bcc-aa78-4d1d-ab82-f7c3c01ab4ff`),
            statusCode: 400,
        });
    }

    static async createOrganizationPeriod(organization: Organization, struct: OrganizationRegistrationPeriodStruct) {
        const period = await RegistrationPeriod.getByID(struct.period.id);

        if (!period) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                human: $t('347463a0-1e9a-40fe-996c-d77ba13bc05b'),
                statusCode: 404,
            });
        }

        if (STAMHOOFD.userMode === 'organization' && period.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id',
                statusCode: 400,
            });
        }

        if (period?.locked) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Period is locked',
                human: $t(`cc658db0-ee90-40fc-8a8c-1074a4f1f2f2`, { '2000-2001': period.getStructure().nameShort }),
            });
        }

        const maximumStart = 1000 * 60 * 60 * 24 * 31 * 8; // 8 months in advance
        if (period.startDate > new Date(Date.now() + maximumStart)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period start date is too far in the future',
                human: $t('2655c006-55af-47e6-959c-16acdb1917dc'),
                field: 'period',
            });
        }

        // Period has ended
        if (STAMHOOFD.environment !== 'development' && period.endDate < new Date()) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period has ended',
                human: $t('44ff6618-ecbf-408b-9cc1-b1479e8ba8a2'),
                field: 'period',
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
            try {
                await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(s, organization.id, period);
            }
            catch (e) {
                // Can happen when a group is no longer valid anymore when duplicating a period
                console.error('Error creating group', s.id, e);
            }
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
            throw Context.auth.error($t(`ab05b3fe-fb52-49d7-a7d5-2d3bcc6dde3e`));
        }

        model.deletedAt = new Date();
        await model.save();

        const events = await Event.select().where('groupId', id).fetch();
        for (const event of events) {
            event.groupId = null;
            await event.save();
        }
    }

    static async patchGroup(struct: AutoEncoderPatchType<GroupStruct>, period?: RegistrationPeriod | null, options: { allowPatchWaitingListPeriod?: boolean; isPatchingEvent?: boolean } = {}) {
        const { allowPatchWaitingListPeriod = false, isPatchingEvent = false } = options;

        const model = await Group.getByID(struct.id);

        if (!model || !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            throw Context.auth.error($t(`0d382103-4a15-4f12-8e3d-feb4d184639d`));
        }

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
                    human: $t(`8c220808-51af-4ea3-a941-9e9e39cd8d20`),
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

            if (!period) {
                throw new SimpleError({
                    code: 'missing_required_relation',
                    message: 'Relation periodId is missing on group ' + model.id,
                    statusCode: 500,
                });
            }
        }

        let shouldUpdatePeriodIds = false;

        if (period) {
            shouldUpdatePeriodIds = period.id !== model.periodId;

            if (shouldUpdatePeriodIds && period.locked) {
                if (period.organizationId === null || !await Context.auth.hasFullAccess(period.organizationId)) {
                    throw new SimpleError({
                        code: 'locked_period',
                        message: 'This period is locked',
                        human: Context.i18n.$t('f544b972-416c-471d-8836-d7f3b16f947d'),
                    });
                }
            }

            if (shouldUpdatePeriodIds) {
                if (!isPatchingEvent && struct.periodId === undefined) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'periodId',
                        message: 'Setting periodId is required when moving a group to a new period',
                    });
                }

                if (STAMHOOFD.userMode === 'organization' && period.organizationId !== model.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_period',
                        message: 'Period has different organization id',
                        statusCode: 400,
                    });
                }

                // Check current period is locked
                const currentPeriod = await RegistrationPeriod.getByID(model.periodId);

                if (!currentPeriod) {
                    throw new SimpleError({
                        code: 'missing_required_relation',
                        message: 'Relation periodId is missing on group ' + model.id,
                        statusCode: 500,
                    });
                }

                if (currentPeriod.locked) {
                    if (currentPeriod.organizationId === null || !await Context.auth.hasFullAccess(currentPeriod.organizationId)) {
                        throw new SimpleError({
                            code: 'locked_period',
                            message: 'This period is locked',
                            human: $t('e115a9d1-11a6-42b9-a781-c6ab9d8a4b9c'),
                        });
                    }
                }

                if ((!isPatchingEvent && model.type === GroupType.EventRegistration) || (model.type === GroupType.WaitingList && !allowPatchWaitingListPeriod)) {
                    throw new SimpleError({
                        code: 'not_supported',
                        message: `Moving group with type ${model.type} to a different period is not supported`,
                        statusCode: 400,
                    });
                }
            }

            if (!isPatchingEvent) {
                if (struct.periodId !== undefined && struct.periodId !== period.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'periodId',
                        message: 'Cannot patch periodId to a different period then the one being patched',
                    });
                }
            }

            model.periodId = period.id;
            model.settings.period = period.getBaseStructure();

            if (model.type !== GroupType.EventRegistration) {
                if (!model.settings.hasCustomDates) {
                    model.settings.endDate = period.endDate;

                    // Note: start date is customizable, as long as it stays between period start and end
                    if (model.settings.startDate < period.startDate || model.settings.startDate > period.endDate) {
                        model.settings.startDate = period.startDate;
                    }
                }

                if (model.settings.startDate > model.settings.endDate) {
                    model.settings.startDate = model.settings.endDate;
                }
            }
        }

        /**
         * A group should only be able to be moved to another period if the waiting list is not shared with other groups in the current period.
         */
        const throwIfUpdateWaitingListPeriodWithMultipleGroups = async (waitingListId: string) => {
            if (shouldUpdatePeriodIds) {
                const groupCount = await Group.select()
                    .where('waitingListId', waitingListId)
                    .whereNot('id', model.id)
                    .whereNot('periodId', model.periodId).limit(1).count();

                if (groupCount > 0) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'periodId',
                        message: 'Group has waiting list with other groups in the current period',
                        human: $t('753684e1-94aa-4663-a81c-9656a51283ae'),
                    });
                }
            }
        };

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
                await throwIfUpdateWaitingListPeriodWithMultipleGroups(patch.waitingList.id);
                await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(patch.waitingList, period, {
                    allowPatchWaitingListPeriod: shouldUpdatePeriodIds,
                    isPatchingEvent,
                });
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
                            human: $t(`b906c293-2afa-4ebe-9b33-2d64ab46da34`),
                        });
                    }

                    model.waitingListId = existing.id;
                }
                else {
                    const requiredPeriod = period ?? await RegistrationPeriod.getByID(model.periodId);

                    if (!requiredPeriod) {
                        throw new Error('Unexpected missing period when creating waiting list');
                    }

                    if (STAMHOOFD.userMode === 'organization' && requiredPeriod.organizationId !== model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_period',
                            message: 'Period has different organization id',
                            statusCode: 400,
                        });
                    }

                    const group = await PatchOrganizationRegistrationPeriodsEndpoint.createGroup(
                        patch.waitingList,
                        model.organizationId,
                        requiredPeriod,
                        {
                            allowedIds: [patch.waitingList.id],
                        },
                    );
                    model.waitingListId = group.id;
                }
            }
        }
        else if (shouldUpdatePeriodIds && model.waitingListId && period) {
            // update waiting list period
            await throwIfUpdateWaitingListPeriodWithMultipleGroups(model.waitingListId);
            await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(
                GroupStruct.patch({
                    id: model.waitingListId,
                    periodId: period.id,
                }),
                period,
                {
                    allowPatchWaitingListPeriod: shouldUpdatePeriodIds,
                    isPatchingEvent,
                },
            );
        }

        if (shouldUpdatePeriodIds) {
            // change the period ids of the registrations in the group
            const { changedRows } = await SQL.update(Registration.table).set('periodId', model.periodId).where('groupId', model.id).update();
            console.log(`Moved ${changedRows} registrations to period ${model.periodId}`);
        }

        model.settings.throwIfInvalidPrices();
        await model.updateOccupancy();
        await model.save();

        return model;
    }

    static async createGroup(struct: GroupStruct, organizationId: string, period: RegistrationPeriod, options?: { allowedIds?: string[] }): Promise<Group> {
        const allowedIds = options?.allowedIds ?? [];

        if (struct.type !== GroupType.EventRegistration && !allowedIds.includes(struct.id)) {
            if (!await Context.auth.hasFullAccess(organizationId)) {
                throw Context.auth.error($t(`153a7443-e2d9-4126-8e10-089b54964fb8`));
            }
        }
        else {
            // For events, permission checking needs to happen outside this method (access to event = access to group)
        }

        if (period.locked) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period is locked',
                human: Context.i18n.$t('f544b972-416c-471d-8836-d7f3b16f947d'),
            });
        }

        if (STAMHOOFD.userMode === 'organization' && (period.organizationId !== organizationId)) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id',
                statusCode: 400,
            });
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

        if (!model.settings.hasCustomDates) {
            model.settings.endDate = period.endDate;

            // Note: start date is customizable, as long as it stays between period start and end
            if (model.settings.startDate < period.startDate || model.settings.startDate > period.endDate) {
                model.settings.startDate = period.startDate;
            }
        }

        if (model.settings.startDate > model.settings.endDate) {
            model.settings.startDate = model.settings.endDate;
        }

        model.settings.registeredMembers = 0;
        model.settings.reservedMembers = 0;

        if (struct.type !== GroupType.EventRegistration && !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
            // Create a temporary permission role for this user
            const organizationPermissions = user.permissions?.organizationPermissions?.get(organizationId);
            if (!organizationPermissions) {
                throw new Error('Unexpected missing permissions');
            }
            const resourcePermissions = ResourcePermissions.create({
                resourceName: model.settings.name.toString(),
                level: PermissionLevel.Full,
            });
            const patch = resourcePermissions.createInsertPatch(PermissionsResourceType.Groups, model.id, organizationPermissions);
            user.permissions!.organizationPermissions.set(organizationId, organizationPermissions.patch(patch));
            console.log('Automatically granted author full permissions to resource', 'group', model.id, 'user', user.id, 'patch', patch.encode({ version: Version }));
            await user.save();

            // Check if current user has permissions to this new group -> else fail with error
            if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'missing_permissions',
                    message: 'You cannot restrict your own permissions',
                    human: $t(`4f4e52b6-288d-4893-a82b-15be8d07acbc`),
                });
            }
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
                    { allowedIds: [struct.waitingList.id] },
                );
                model.waitingListId = group.id;
            }
        }

        await model.save();
        return model;
    }
}
