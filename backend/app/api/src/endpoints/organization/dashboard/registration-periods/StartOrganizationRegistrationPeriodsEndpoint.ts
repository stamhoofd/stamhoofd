import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Response } from '@simonbackx/simple-endpoints';
import { GroupPrivateSettings, GroupStatus, GroupType, OrganizationRegistrationPeriodSettings, PermissionLevel, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import type { OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Group as GroupStruct } from '@stamhoofd/structures';
import { Endpoint } from '@simonbackx/simple-endpoints';
import { Context } from '../../../../helpers/Context.js';
import type { Organization } from '@stamhoofd/models';
import { OrganizationRegistrationPeriod, RegistrationPeriod, Group, Platform, EmailTemplate } from '@stamhoofd/models';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';

type Params = Record<string, never>;
type Query = undefined;
class Body extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    fromPeriodId?: string;

    @field({ decoder: StringDecoder })
    toPeriodId: string;
}
type ResponseBody = OrganizationRegistrationPeriodStruct;

export class StartOrganizationRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [false] | [true, Params] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/registration-periods/start', {});

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

        const toPeriod = await RegistrationPeriod.getByID(request.body.toPeriodId);
        if (!toPeriod) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                human: $t('%15j'),
                statusCode: 404,
            });
        }

        if (STAMHOOFD.userMode === 'organization' && toPeriod.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id',
                statusCode: 400,
            });
        }

        if (toPeriod.locked) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Period is locked',
                human: $t(`%15m`, { '2000-2001': toPeriod.getStructure().nameShort }),
            });
        }

        const maximumStart = 1000 * 60 * 60 * 24 * 31 * 8; // 8 months in advance
        if (toPeriod.startDate > new Date(Date.now() + maximumStart) && STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period start date is too far in the future',
                human: $t('%15k'),
                field: 'period',
            });
        }

        // Period has ended
        if (STAMHOOFD.environment !== 'development' && toPeriod.endDate < new Date() && STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period has ended',
                human: $t('%15l'),
                field: 'period',
            });
        }

        if (!request.body.fromPeriodId || !organization.periodId) {
            const registrationPeriod = new OrganizationRegistrationPeriod();
            registrationPeriod.periodId = toPeriod.id;
            await registrationPeriod.save();

            return new Response(
                await AuthenticatedStructures.organizationRegistrationPeriod(registrationPeriod),
            );
        }

        const fromOrganizationPeriod = await OrganizationRegistrationPeriod.getByID(request.body.fromPeriodId ?? organization.periodId);
        if (!fromOrganizationPeriod) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                human: $t('%15j'),
                statusCode: 404,
            });
        }

        // Copy data
        const newOrganizationRegistrationPeriod = await this.duplicateOrganizationRegistrationPeriod(fromOrganizationPeriod, toPeriod, organization);

        const groups = await Group.getAll(organization.id, newOrganizationRegistrationPeriod.periodId);

        // Delete unreachable categories first
        await newOrganizationRegistrationPeriod.cleanCategories(groups);
        await Group.deleteUnreachable(organization.id, newOrganizationRegistrationPeriod, groups);

        return new Response(
            await AuthenticatedStructures.organizationRegistrationPeriod(newOrganizationRegistrationPeriod),
        );
    }

    private async duplicateOrganizationRegistrationPeriod(from: OrganizationRegistrationPeriod, to: RegistrationPeriod, organization: Organization) {
        const fromPeriod = await RegistrationPeriod.getByID(from.periodId);
        const fromStruct = await AuthenticatedStructures.organizationRegistrationPeriod(from);

        if (!fromPeriod) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                human: $t('%15j'),
                statusCode: 404,
            });
        }

        const organizationPeriod = new OrganizationRegistrationPeriod();
        organizationPeriod.organizationId = organization.id;
        organizationPeriod.periodId = to.id;

        const fromSettingsClone = from.settings.clone();

        const discountMap = new Map<string, string>();
        organizationPeriod.settings = OrganizationRegistrationPeriodSettings.create({
            bundleDiscounts: fromSettingsClone.bundleDiscounts.map((discount) => {
                const newDiscount = discount.clone();
                newDiscount.id = uuidv4();
                discountMap.set(discount.id, newDiscount.id);
                return newDiscount;
            }),
        });

        await organizationPeriod.save();

        const yearDifference = to.startDate.getFullYear() - fromPeriod.startDate.getFullYear();

        // Create new groups + map old to new groups
        const groupMap = new Map<string, string>();
        const categoryMap = new Map<string, string>();

        const newGroups: Group[] = [];

        for (const group of fromStruct.groups) {
            const newGroup = await this.createGroup(group, organization.id, to, yearDifference, discountMap);

            groupMap.set(group.id, newGroup.id);
            newGroups.push(newGroup);

            await this.duplicateEmailTemplate(group.id, newGroup.id, organization.id);
        }

        // Fix waiting list ids
        for (const group of newGroups) {
            if (group.waitingListId) {
                const newId = groupMap.get(group.waitingListId) ?? null;
                if (newId) {
                    group.waitingListId = newGroups.find(g => g.id === newId)?.id ?? null;
                } else {
                    group.waitingListId = null;
                }
            }
        }

        for (const category of fromSettingsClone.categories) {
            const newCategory = category.clone();
            newCategory.id = uuidv4();
            newCategory.groupIds = category.groupIds.map(groupId => groupMap.get(groupId)!).filter(id => id);

            categoryMap.set(category.id, newCategory.id);
            organizationPeriod.settings.categories.push(newCategory);
        }

        // Update category ids
        for (const category of organizationPeriod.settings.categories) {
            category.categoryIds = category.categoryIds.map(categoryId => categoryMap.get(categoryId)!).filter(id => id);
        }

        // Update root category id
        organizationPeriod.settings.rootCategoryId = categoryMap.get(fromSettingsClone.rootCategoryId)!;
        return organizationPeriod;
    }

    private async createGroup(struct: GroupStruct, organizationId: string, period: RegistrationPeriod, yearDifference: number, discountMap: Map<string, string>, options?: { allowedIds?: string[] }): Promise<Group> {
        const allowedIds = options?.allowedIds ?? [];

        const model = new Group();
        model.organizationId = organizationId;
        model.defaultAgeGroupId = await this.validateDefaultGroupId(struct.defaultAgeGroupId);
        model.periodId = period.id;
        model.settings = struct.settings;
        model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({});
        model.status = struct.status;
        model.type = struct.type;
        model.settings.period = period.getBaseStructure();

        if (model.settings.registrationStartDate && struct.settings.registrationStartDate) {
            model.settings.registrationStartDate.setFullYear(
                struct.settings.registrationStartDate.getFullYear()
                + yearDifference,
            );
        }
        if (model.settings.registrationEndDate && struct.settings.registrationEndDate) {
            model.settings.registrationEndDate.setFullYear(
                struct.settings.registrationEndDate.getFullYear()
                + yearDifference,
            );
        }

        for (const price of model.settings.prices) {
            if (price.startDate) {
                price.startDate.setFullYear(price.startDate.getFullYear() + yearDifference);
            }

            if (price.endDate) {
                price.endDate.setFullYear(price.endDate.getFullYear() + yearDifference);
            }

            // Remap the bundle discount references to the newly generated discount ids
            price.bundleDiscounts = new Map(
                [...price.bundleDiscounts].map(([discountId, settings]) => [discountMap.get(discountId) ?? discountId, settings]),
            );
        }

        // Force close
        if (struct.type !== GroupType.WaitingList) {
            model.status = GroupStatus.Closed;
        }

        if (struct.type !== GroupType.EventRegistration && !allowedIds.includes(struct.id)) {
            if (!await Context.auth.hasFullAccess(organizationId)) {
                throw Context.auth.error($t(`%FA`));
            }
        } else {
            // For events, permission checking needs to happen outside this method (access to event = access to group)
        }

        struct.settings.validateName();

        if (STAMHOOFD.userMode === 'organization' && (period.organizationId !== organizationId)) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id',
                statusCode: 400,
            });
        }

        const user = Context.auth.user;

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
                    human: $t(`%FB`),
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

                if (existing.periodId !== model.periodId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        field: 'waitingList',
                        message: 'Waiting list group is already used in another period',
                        human: $t(`%F9`),
                    });
                }

                model.waitingListId = existing.id;
            } else {
                throw new SimpleError({
                    code: 'invalid_waiting_list',
                    field: 'waitingList',
                    message: 'Waiting list not found',
                    human: $t('%ZZb'),
                    statusCode: 404,
                });
            }
        }

        await model.save();
        return model;
    }

    private async duplicateEmailTemplate(fromGroupId: string, toGroupId: string, organizationId: string) {
        const originalTemplate = await EmailTemplate.select()
            .where('organizationId', organizationId)
            .andWhere('groupId', fromGroupId)
            .first(false);

        if (originalTemplate) {
            const newTemplate = new EmailTemplate();
            newTemplate.copyFrom(originalTemplate);

            newTemplate.groupId = toGroupId;

            await newTemplate.save();
        }
    }

    private async validateDefaultGroupId(id: string | null): Promise<string | null> {
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
                human: $t(`%F4`),
                statusCode: 400,
            });
        }

        throw new SimpleError({
            code: 'invalid_default_age_group',
            message: 'Invalid default age group',
            human: $t(`%F5`),
            statusCode: 400,
        });
    }
}
