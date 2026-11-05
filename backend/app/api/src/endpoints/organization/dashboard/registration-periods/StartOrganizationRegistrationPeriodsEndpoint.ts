import type { Decoder } from '@common/encoding';
import { AutoEncoder, field, StringDecoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Context } from '../../../../helpers/Context.js';
import { Organization, Platform } from '@stamhoofd/models';
import { EmailTemplate, Group, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/models';
import type { Group as GroupStruct } from '@stamhoofd/structures';
import { GroupPrivateSettings, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, ResourcePermissions, Version } from '@stamhoofd/structures';
import { SimpleError } from '@common/errors';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';

type Params = Record<string, never>;
type Query = undefined;
class Body extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    fromOrganizationRegistrationPeriodId?: string;

    @field({ decoder: StringDecoder })
    toRegistrationPeriodId: string;
}
type ResponseBody = OrganizationRegistrationPeriodStruct;

export class StartOrganizationRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [false] | [true, Params] {
        if (request.method !== 'POST') {
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

        const period = await RegistrationPeriod.getByID(request.body.toRegistrationPeriodId);
        if (!period) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                human: $t('%15j'),
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

        if (period.locked) {
            throw new SimpleError({
                code: 'locked_period',
                message: 'Period is locked',
                human: $t('%15m', { '2000-2001': period.getStructure().nameShort }),
            });
        }

        const maximumStart = 1000 * 60 * 60 * 24 * 31 * 8; // 8 months in advance
        if (period.startDate > new Date(Date.now() + maximumStart) && STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period start date is too far in the future',
                human: $t('%15k'),
                field: 'period',
            });
        }

        // Period has ended
        if (STAMHOOFD.environment !== 'development' && period.endDate < new Date() && STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Period has ended',
                human: $t('%15l'),
                field: 'period',
            });
        }

        const periodStruct = period.getStructure();

        let newOrganizationRegistrationPeriodStruct = OrganizationRegistrationPeriodStruct.create({
            period: periodStruct,
        });
        let groupMap: Map<string, string> = new Map();

        if (request.body.fromOrganizationRegistrationPeriodId) {
            const currentOrganizationRegistrationPeriod = await OrganizationRegistrationPeriod.getByID(request.body.fromOrganizationRegistrationPeriodId);

            if (!currentOrganizationRegistrationPeriod) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Organization Period not found',
                    human: $t('%15j'),
                    statusCode: 404 });
            }

            const groups = await Group.getAll(organization.id, currentOrganizationRegistrationPeriod.periodId);

            const {
                newOrganizationPeriod,
                groupMap: newGroupMap,
            } = currentOrganizationRegistrationPeriod.getStructure(period, groups).duplicate(
                periodStruct,
            );

            newOrganizationRegistrationPeriodStruct = newOrganizationPeriod;
            groupMap = newGroupMap;
        }

        const newOrganizationRegistrationPeriod = await StartOrganizationRegistrationPeriodsEndpoint.createOrganizationPeriod(organization, newOrganizationRegistrationPeriodStruct, period, groupMap);

        return new Response(
            await AuthenticatedStructures.organizationRegistrationPeriod(newOrganizationRegistrationPeriod),
        );
    }

    static async createOrganizationPeriod(organization: Organization, struct: OrganizationRegistrationPeriodStruct, period: RegistrationPeriod, groupMap: Map<string, string>) {
        const organizationPeriod = new OrganizationRegistrationPeriod();
        organizationPeriod.id = struct.id;
        organizationPeriod.organizationId = organization.id;
        organizationPeriod.periodId = struct.period.id;
        organizationPeriod.settings = struct.settings;
        await organizationPeriod.save();

        // Create waiting list groups first: a regular group referencing a waiting list requires
        // that waiting list group to already exist in the same period (see createGroup), otherwise
        // it fails with 'Waiting list not found' and gets silently skipped below.
        const sortedGroups = [...struct.groups].sort((a, b) => {
            if (a.type === GroupType.WaitingList && b.type !== GroupType.WaitingList) {
                return -1;
            }
            if (b.type === GroupType.WaitingList && a.type !== GroupType.WaitingList) {
                return 1;
            }
            return 0;
        });

        const createdGroups: Group[] = [];

        for (const s of sortedGroups) {
            s.settings.registeredMembers = 0;
            s.settings.reservedMembers = 0;
            try {
                const model = await StartOrganizationRegistrationPeriodsEndpoint.createGroup(s, organization.id, period);
                createdGroups.push(model);
            } catch (e) {
                // Can happen when a group is no longer valid anymore when duplicating a period
                console.error('Error creating group', s.id, e);
            }
        }
        const groups = await Group.getAll(organization.id, organizationPeriod.periodId);
        await StartOrganizationRegistrationPeriodsEndpoint.duplicateEmailTemplates(organization, groupMap);

        // Delete unreachable categories first
        await organizationPeriod.cleanCategories(groups);
        await Group.deleteUnreachable(organization.id, organizationPeriod, groups);

        return organizationPeriod;
    }

    static async getOrganizationPeriodOrThrow(organizationId: string, period: RegistrationPeriod, options?: { isPatchingEvent?: boolean }): Promise<OrganizationRegistrationPeriod> {
        const organizationPeriod = await OrganizationRegistrationPeriod.select()
            .where('organizationId', organizationId)
            .where('periodId', period.id)
            .first(false);

        if (!organizationPeriod) {
            const organization = await Organization.getByID(organizationId);

            throw new SimpleError({
                code: 'missing_organization_period',
                message: `Organization ${organizationId} has not started period ${period.id}`,
                human: $t('%Zrr', {
                    organization: organization?.name ?? $t('%Zru'),
                    period: period.getStructure().nameShort,
                }),
                // Only set when patching an event: the period of an event group follows from the
                // start date of the event, which EditEventView renders this error under
                field: options?.isPatchingEvent ? 'startDate' : undefined,
                statusCode: 400,
            });
        }

        return organizationPeriod;
    }

    static async createGroup(struct: GroupStruct, organizationId: string, period: RegistrationPeriod, options?: { allowedIds?: string[] }): Promise<Group> {
        const allowedIds = options?.allowedIds ?? [];

        if (struct.type !== GroupType.EventRegistration && !allowedIds.includes(struct.id)) {
            if (!await Context.auth.hasFullAccess(organizationId)) {
                throw Context.auth.error($t('%FA'));
            }
        } else {
            // For events, permission checking needs to happen outside this method (access to event = access to group)
        }

        if (period.locked) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period is locked',
                human: Context.i18n.$t('%AW'),
            });
        }

        struct.settings.validateName();

        if (STAMHOOFD.userMode === 'organization' && (period.organizationId !== organizationId)) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id',
                statusCode: 400,
            });
        }

        if (struct.type === GroupType.EventRegistration) {
            await this.getOrganizationPeriodOrThrow(organizationId, period);
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
                resourceName: model.settings.getNameWithPeriod(),
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
                    human: $t('%FB'),
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
                        human: $t('%F9'),
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
                human: $t('%F4'),
                statusCode: 400,
            });
        }

        throw new SimpleError({
            code: 'invalid_default_age_group',
            message: 'Invalid default age group',
            human: $t('%F5'),
            statusCode: 400,
        });
    }

    static async duplicateEmailTemplates(organization: Organization, groupMap: Map<string, string>) {
        for (const [originalGroupId, newGroupId] of groupMap.entries()) {
            const originalTemplates = await EmailTemplate.select()
                .where('organizationId', organization.id)
                .andWhere('groupId', originalGroupId)
                .fetch();

            for (const template of originalTemplates) {
                const newTemplate = new EmailTemplate();
                newTemplate.subject = template.subject;
                newTemplate.organizationId = template.organizationId;
                newTemplate.type = template.type;
                newTemplate.json = template.json;
                newTemplate.html = template.html;
                newTemplate.text = template.text;
                newTemplate.translations = template.translations;
                newTemplate.language = template.language;

                newTemplate.groupId = newGroupId;

                await newTemplate.save();
            }
        }
    }
}
