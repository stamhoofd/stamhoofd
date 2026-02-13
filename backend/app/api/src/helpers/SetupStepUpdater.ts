import { Model } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import {
    Group,
    Member,
    MemberResponsibilityRecord,
    Organization,
    OrganizationRegistrationPeriod,
    Platform,
    Registration,
} from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import {
    AuditLogSource,
    GroupType,
    MemberResponsibility,
    Platform as PlatformStruct,
    RecordCategory,
    SetupStepType,
    SetupSteps,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogService } from '../services/AuditLogService.js';
import { GroupedThrottledQueue } from './GroupedThrottledQueue.js';
import { AuthenticatedStructures } from './AuthenticatedStructures.js';

type SetupStepOperation = (setupSteps: SetupSteps, organization: Organization, platform: PlatformStruct) => void | Promise<void>;

/**
 * Helper function to detect whether we should update the setup steps if a group is changed
 */
async function getGroupMemberCompletion(group: Group) {
    const defaultAgeGroupId = group.defaultAgeGroupId;

    if (!defaultAgeGroupId) {
        // Not included = no step
        return null;
    }

    if (group.deletedAt) {
        // Not included = no step
        return null;
    }

    const platform = await Platform.getSharedStruct();

    if (group.periodId !== platform.period.id) {
        // Not included = no step
        return null;
    }

    const defaultAgeGroup = platform.config.defaultAgeGroups.find(g => g.id === defaultAgeGroupId);

    if (!defaultAgeGroup) {
        // Not included = no step
        return null;
    }

    const required = defaultAgeGroup.minimumRequiredMembers;
    if (required === 0) {
        // Not included = no step
        return null;
    }

    return Math.min(required, group.settings.registeredMembers ?? 0);
}

export class SetupStepUpdater {
    static isListening = false;

    static listen() {
        if (this.isListening) {
            return;
        }
        this.isListening = true;
        Model.modelEventBus.addListener({}, async (event) => {
            if (!(event.model instanceof Group)) {
                return;
            }

            const before = (event.type === 'updated' ? await getGroupMemberCompletion(event.getOldModel() as Group) : (event.type === 'deleted' ? await getGroupMemberCompletion(event.model) : null));
            const after = (event.type === 'updated' ? await getGroupMemberCompletion(event.model) : (event.type === 'created' ? await getGroupMemberCompletion(event.model) : null));

            if (before !== after) {
                console.log('Updating setups steps for organization', event.model.organizationId, 'because of change in members in group', event.model.id, 'from', before, 'to', after, '(limited)');
                // We need to do a recalculation
                SetupStepUpdater.updateForOrganizationId(event.model.organizationId, { types: [SetupStepType.Registrations] })
                    .catch(console.error);
            }
        });

        const updateResponsibilitiesQueue = new GroupedThrottledQueue(async (organizationId: string) => {
            console.log('(delayed) Updating setups steps for organization', organizationId, 'because of change in registrations');
            SetupStepUpdater.updateForOrganizationId(organizationId, { types: [SetupStepType.Responsibilities] }).catch(console.error);
        }, { maxDelay: 3_000 });

        Model.modelEventBus.addListener({}, async (event) => {
            if (!(event.model instanceof Registration)) {
                return;
            }

            if ((event.type === 'updated' && ('registeredAt' in event.changedFields || 'deactivatedAt' in event.changedFields)) || (event.type === 'created' && event.model.registeredAt)) {
                updateResponsibilitiesQueue.addItem(event.model.organizationId, 1);
            }
        });
    }

    private static readonly STEP_TYPE_OPERATIONS: Record<
        SetupStepType,
        SetupStepOperation
    > = {
            [SetupStepType.Responsibilities]: this.updateStepResponsibilities,
            [SetupStepType.Companies]: this.updateStepCompanies,
            [SetupStepType.Groups]: this.updateStepGroups,
            [SetupStepType.Premises]: this.updateStepPremises,
            [SetupStepType.Emails]: this.updateStepEmails,
            [SetupStepType.Payment]: this.updateStepPayment,
            [SetupStepType.Registrations]: this.updateStepRegistrations,
        };

    static async updateSetupStepsForAllOrganizationsInCurrentPeriod({
        batchSize,
    }: { batchSize?: number } = {}) {
        const tag = 'updateSetupStepsForAllOrganizationsInCurrentPeriod';
        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            const platform = (await Platform.getSharedPrivateStruct()).clone();

            const periodId = platform.period.id;

            let lastId = '';

            while (true) {
                const organizationRegistrationPeriods
                    = await OrganizationRegistrationPeriod.where(
                        {
                            id: { sign: '>', value: lastId },
                            periodId: periodId,
                        },
                        { limit: batchSize ?? 10, sort: ['id'] },
                    );

                if (organizationRegistrationPeriods.length === 0) {
                    lastId = '';
                    break;
                }

                const organizationPeriodMap = new Map(
                    organizationRegistrationPeriods.map((period) => {
                        return [period.organizationId, period];
                    }),
                );

                const organizations = await Organization.getByIDs(
                    ...organizationPeriodMap.keys(),
                );

                for (const organization of organizations) {
                    const organizationId = organization.id;
                    const organizationRegistrationPeriod
                        = organizationPeriodMap.get(organizationId);

                    if (!organizationRegistrationPeriod) {
                        console.error(
                            `[FLAG-MOMENT] organizationRegistrationPeriod not found for organization with id ${organizationId}`,
                        );
                        continue;
                    }

                    console.log(
                        '[FLAG-MOMENT] checking flag moments for '
                        + organizationId,
                    );

                    await SetupStepUpdater.updateFor(
                        organizationRegistrationPeriod,
                        platform,
                        organization,
                    );
                }

                lastId
                    = organizationRegistrationPeriods[
                        organizationRegistrationPeriods.length - 1
                    ].id;
            }
        });
    }

    static async updateForOrganizationId(id: string, options?: { types?: SetupStepType[] }) {
        const organization = await Organization.getByID(id);
        if (!organization) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Organization not found',
                human: $t(`e73b24c3-584d-4a0c-beae-c50f46c33d90`),
            });
        }

        await this.updateForOrganization(organization, options);
    }

    static async updateForOrganization(
        organization: Organization,
        {
            platform,
            organizationRegistrationPeriod,
            types,
        }: {
            platform?: PlatformStruct;
            organizationRegistrationPeriod?: OrganizationRegistrationPeriod;
            types?: SetupStepType[];
        } = {},
    ) {
        if (!platform) {
            platform = await Platform.getSharedPrivateStruct();
            if (!platform) {
                console.error('No platform not found');
                return;
            }
        }

        if (!organizationRegistrationPeriod) {
            const periodId = platform.period.id;
            organizationRegistrationPeriod = (
                await OrganizationRegistrationPeriod.where({
                    organizationId: organization.id,
                    periodId: periodId,
                })
            )[0];

            if (!organizationRegistrationPeriod) {
                console.error(
                    `OrganizationRegistrationPeriod with organizationId ${organization.id} and periodId ${periodId} not found`,
                );
                return;
            }
        }

        await this.updateFor(
            organizationRegistrationPeriod,
            platform,
            organization,
            types,
        );
    }

    private static async updateFor(
        organizationRegistrationPeriod: OrganizationRegistrationPeriod,
        platform: PlatformStruct,
        organization: Organization,
        types?: SetupStepType[],
    ) {
        console.log('Updating setup steps for organization', organization.id);
        const setupSteps = organizationRegistrationPeriod.setupSteps;

        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            for (const stepType of types ?? Object.values(SetupStepType)) {
                const operation = this.STEP_TYPE_OPERATIONS[stepType];
                await operation(setupSteps, organization, platform);
            }

            await organizationRegistrationPeriod.save();
        });
    }

    private static updateStepPremises(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct,
    ) {
        let totalSteps = 0;
        let finishedSteps = 0;

        const premiseTypes = platform.config.premiseTypes;

        for (const premiseType of premiseTypes) {
            const { min, max } = premiseType;

            // only add step if premise type has restrictions
            if (min === null && max === null) {
                continue;
            }

            totalSteps++;

            const premiseTypeId = premiseType.id;
            let totalPremisesOfThisType = 0;

            for (const premise of organization.privateMeta.premises) {
                if (premise.premiseTypeIds.includes(premiseTypeId)) {
                    totalPremisesOfThisType++;
                }
            }

            if (max !== null && totalPremisesOfThisType > max) {
                continue;
            }

            if (min !== null && totalPremisesOfThisType < min) {
                continue;
            }

            finishedSteps++;
        }

        if (premiseTypes.length > 0) {
            setupSteps.update(SetupStepType.Premises, {
                totalSteps,
                finishedSteps,
            });
        }
        else {
            // if no premise types, remove step
            setupSteps.remove(SetupStepType.Premises);
        }
    }

    private static updateStepGroups(
        setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct,
    ) {
        setupSteps.update(SetupStepType.Groups, {
            totalSteps: 0,
            finishedSteps: 0,
        });
    }

    private static updateStepCompanies(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct,
    ) {
        const totalSteps = 1;
        let finishedSteps = 0;

        if (organization.meta.companies.length) {
            finishedSteps = 1;

            try {
                RecordCategory.validate(
                    platform.config.organizationLevelRecordsConfiguration.recordCategories,
                    organization.getBaseStructureWithPrivateMeta(), // private data needed for answers
                );
            }
            catch (error) {
                console.error('Error validating record categories for organization', organization.id, error);
                finishedSteps = 0;
            }
        }

        console.log('Updating companies step for organization', organization.id, 'with total steps', totalSteps, 'and finished steps', finishedSteps);

        setupSteps.update(SetupStepType.Companies, {
            totalSteps,
            finishedSteps,
        });
    }

    private static async updateStepResponsibilities(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct,
    ) {
        const now = new Date();
        const organizationBasedResponsibilitiesWithRestriction = platform.config.responsibilities
            .filter(r => r.organizationBased && (r.minimumMembers || r.maximumMembers));

        const responsibilityIds = organizationBasedResponsibilitiesWithRestriction.map(r => r.id);

        const allRecords = responsibilityIds.length === 0
            ? []
            : await MemberResponsibilityRecord.select()
                .where('responsibilityId', responsibilityIds)
                .where('organizationId', organization.id)
                .where(SQL.where('endDate', SQLWhereSign.Greater, now).or('endDate', null))
                .fetch();

        // Remove invalid responsibilities: members that are not registered in the current period
        const memberIds = Formatter.uniqueArray(allRecords.map(r => r.memberId));
        const _members = await Member.getByIDs(...memberIds);
        const members = await Member.loadRegistrations(_members, true);
        const validMembers = members.filter(m => m.registrations.some(r => r.organizationId === organization.id && r.periodId === organization.periodId && r.group.defaultAgeGroupId && r.group.type === GroupType.Membership && r.deactivatedAt === null && r.registeredAt !== null));
        const invalidMembers = members.filter(m => !m.registrations.some(r => r.organizationId === organization.id && r.periodId === organization.periodId && r.group.defaultAgeGroupId && r.group.type === GroupType.Membership && r.deactivatedAt === null && r.registeredAt !== null));

        const validMembersIds = validMembers.map(m => m.id);
        const invalidMembersIds = invalidMembers.map(m => m.id);

        const records = allRecords.filter(r => validMembersIds.includes(r.memberId));
        const invalidRecords = allRecords.filter(r => invalidMembersIds.includes(r.memberId));

        let totalSteps = 0;
        let finishedSteps = 0;

        const groups = await Group.getAll(organization.id, organization.periodId);

        const flatResponsibilities: { responsibility: MemberResponsibility; group: Group | null }[] = organizationBasedResponsibilitiesWithRestriction
            .flatMap((responsibility) => {
                const defaultAgeGroupIds = responsibility.defaultAgeGroupIds;
                if (defaultAgeGroupIds === null) {
                    const item: { responsibility: MemberResponsibility; group: Group | null } = {
                        responsibility,
                        group: null,
                    };
                    return [item];
                }

                return groups
                    .filter(g => g.defaultAgeGroupId !== null && defaultAgeGroupIds.includes(g.defaultAgeGroupId))
                    .map((group) => {
                        return {
                            responsibility,
                            group,
                        };
                    });
            });

        for (const { responsibility, group } of flatResponsibilities) {
            const { minimumMembers: min, maximumMembers: max } = responsibility;

            const invalidMembersWithThisResponsibility = !!invalidRecords.find(r => r.responsibilityId === responsibility.id && (group ? r.groupId === group.id : true));
            if (invalidMembersWithThisResponsibility) {
                totalSteps += Math.max(min ?? 1, 1);
                // Step not okay: we have an invalid member with this responsibility
                continue;
            }

            if (min === null) {
                continue;
            }

            totalSteps += min;

            const responsibilityId = responsibility.id;
            let totalRecordsWithThisResponsibility = 0;

            if (group === null) {
                for (const record of records) {
                    if (record.responsibilityId === responsibilityId) {
                        totalRecordsWithThisResponsibility++;
                    }
                }
            }
            else {
                for (const record of records) {
                    if (record.responsibilityId === responsibilityId && record.groupId === group.id) {
                        totalRecordsWithThisResponsibility++;
                    }
                }
            }

            if (max !== null && totalRecordsWithThisResponsibility > max) {
                // Not added (not okay)
                continue;
            }

            finishedSteps += Math.min(min, totalRecordsWithThisResponsibility);
        }

        console.log('Updating responsibilities step for organization', organization.id, 'with total steps', totalSteps, 'and finished steps', finishedSteps);
        setupSteps.update(SetupStepType.Responsibilities, {
            totalSteps,
            finishedSteps,
        });
    }

    private static updateStepEmails(setupSteps: SetupSteps,
        organization: Organization,
        _platform: PlatformStruct) {
        const totalSteps = 1;
        let finishedSteps = 0;

        const emails = organization.privateMeta.emails;

        // organization should have 1 default email
        if (emails.some(e => e.default)) {
            finishedSteps = 1;
        }

        setupSteps.update(SetupStepType.Emails, {
            totalSteps,
            finishedSteps,
        });

        if (finishedSteps >= totalSteps) {
            setupSteps.markReviewed(SetupStepType.Emails, { userId: 'backend', userName: 'backend' });
        }
        else {
            setupSteps.resetReviewed(SetupStepType.Emails);
        }
    }

    private static updateStepPayment(setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct) {
        setupSteps.update(SetupStepType.Payment, {
            totalSteps: 0,
            finishedSteps: 0,
        });
    }

    private static async updateStepRegistrations(setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct) {
        const defaultAgeGroupIds = platform.config.defaultAgeGroups.filter(g => g.minimumRequiredMembers > 0).map(x => x.id);

        const groupsWithDefaultAgeGroups = defaultAgeGroupIds.length > 0
            ? await Group.select()
                .where('organizationId', organization.id)
                .where('periodId', platform.period.id)
                .where('defaultAgeGroupId', defaultAgeGroupIds)
                .where('deletedAt', null)
                .fetch()
            : [];

        let totalSteps = 0;

        // Count per default age group, (e.g. minmium 10 means the total across all members with the same age group id should be 10, not 10 each)
        const processedDefaultAgeGroupIds: Map<string, number> = new Map();

        for (const group of groupsWithDefaultAgeGroups) {
            const defaultAgeGroup = platform.config.defaultAgeGroups.find(g => g.id === group.defaultAgeGroupId);
            if (!defaultAgeGroup) {
                continue;
            }
            if (!processedDefaultAgeGroupIds.has(defaultAgeGroup.id)) {
                totalSteps += defaultAgeGroup.minimumRequiredMembers;
                processedDefaultAgeGroupIds.set(defaultAgeGroup.id, Math.min(defaultAgeGroup.minimumRequiredMembers, group.settings.registeredMembers ?? 0));
            }
            else {
                processedDefaultAgeGroupIds.set(defaultAgeGroup.id,
                    Math.min(
                        defaultAgeGroup.minimumRequiredMembers,
                        processedDefaultAgeGroupIds.get(defaultAgeGroup.id)! + (group.settings.registeredMembers ?? 0),
                    ),
                );
            }
        }

        const finishedSteps = Array.from(processedDefaultAgeGroupIds.values()).reduce((a, b) => a + b, 0);

        setupSteps.update(SetupStepType.Registrations, {
            totalSteps,
            finishedSteps,
        });

        if (finishedSteps >= totalSteps) {
            setupSteps.markReviewed(SetupStepType.Registrations, { userId: 'backend', userName: 'backend' });
        }
        else {
            setupSteps.resetReviewed(SetupStepType.Registrations);
        }
    }
}
