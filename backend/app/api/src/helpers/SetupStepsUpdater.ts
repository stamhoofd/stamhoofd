import {
    Group,
    MemberResponsibilityRecord,
    Organization,
    OrganizationRegistrationPeriod,
    Platform
} from "@stamhoofd/models";
import { QueueHandler } from "@stamhoofd/queues";
import { SQL, SQLWhereSign } from "@stamhoofd/sql";
import {
    MemberResponsibility,
    Platform as PlatformStruct,
    SetupStepType,
    SetupSteps
} from "@stamhoofd/structures";

type SetupStepOperation = (setupSteps: SetupSteps, organization: Organization, platform: PlatformStruct) => void | Promise<void>;

export class SetupStepUpdater {
    private static readonly STEP_TYPE_OPERATIONS: Record<
        SetupStepType,
        SetupStepOperation
    > = {
        [SetupStepType.Responsibilities]: this.updateStepResponsibilities,
        [SetupStepType.Companies]: this.updateStepCompanies,
        [SetupStepType.Groups]: this.updateStepGroups,
        [SetupStepType.Premises]: this.updateStepPremises,
        [SetupStepType.Emails]: this.updateStepEmails,
        [SetupStepType.Payment]: this.updateStepPayment
    };

    static async updateSetupStepsForAllOrganizationsInCurrentPeriod({
        batchSize
    }: { batchSize?: number } = {}) {
        const tag = "updateSetupStepsForAllOrganizationsInCurrentPeriod";
        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            const platform = (await Platform.getSharedPrivateStruct()).clone();
            
            const periodId = platform.period.id;

            let lastId = "";

            while (true) {
                const organizationRegistrationPeriods =
                    await OrganizationRegistrationPeriod.where(
                        {
                            id: { sign: ">", value: lastId },
                            periodId: periodId,
                        },
                        { limit: batchSize ?? 10, sort: ["id"] }
                    );

                if (organizationRegistrationPeriods.length === 0) {
                    lastId = "";
                    break;
                }

                const organizationPeriodMap = new Map(
                    organizationRegistrationPeriods.map((period) => {
                        return [period.organizationId, period];
                    })
                );

                const organizations = await Organization.getByIDs(
                    ...organizationPeriodMap.keys()
                );

                for (const organization of organizations) {
                    const organizationId = organization.id;
                    const organizationRegistrationPeriod =
                        organizationPeriodMap.get(organizationId);

                    if (!organizationRegistrationPeriod) {
                        console.error(
                            `[FLAG-MOMENT] organizationRegistrationPeriod not found for organization with id ${organizationId}`
                        );
                        continue;
                    }

                    console.log(
                        "[FLAG-MOMENT] checking flag moments for " +
                            organizationId
                    );

                    await SetupStepUpdater.updateFor(
                        organizationRegistrationPeriod,
                        platform,
                        organization
                    );
                }

                lastId =
                    organizationRegistrationPeriods[
                        organizationRegistrationPeriods.length - 1
                    ].id;
            }
        });
    }

    static async updateForOrganization(
        organization: Organization,
        {
            platform,
            organizationRegistrationPeriod,
        }: {
            platform?: PlatformStruct;
            organizationRegistrationPeriod?: OrganizationRegistrationPeriod;
        } = {}
    ) {
        if (!platform) {
            platform = await Platform.getSharedPrivateStruct();
            if (!platform) {
                console.error("No platform not found");
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
                    `OrganizationRegistrationPeriod with organizationId ${organization.id} and periodId ${periodId} not found`
                );
                return;
            }
        }

        await this.updateFor(
            organizationRegistrationPeriod,
            platform,
            organization
        );
    }

    private static async updateFor(
        organizationRegistrationPeriod: OrganizationRegistrationPeriod,
        platform: PlatformStruct,
        organization: Organization
    ) {
        const setupSteps = organizationRegistrationPeriod.setupSteps;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const stepType of Object.values(SetupStepType)) {
            console.log(`[STEP TYPE] ${stepType}`);
            const operation = this.STEP_TYPE_OPERATIONS[stepType];
            await operation(setupSteps, organization, platform);
        }

        await organizationRegistrationPeriod.save();
    }

    private static updateStepPremises(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct
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

        setupSteps.update(SetupStepType.Premises, {
            totalSteps,
            finishedSteps,
        });
    }

    private static updateStepGroups(
        setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct
    ) {
        setupSteps.update(SetupStepType.Groups, {
            totalSteps: 0,
            finishedSteps: 0,
        });
    }

    private static updateStepCompanies(
        setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct
    ) {
        const totalSteps = 1;
        let finishedSteps = 0;

        if(_organization.meta.companies.length) {
            finishedSteps = 1;
        }

        setupSteps.update(SetupStepType.Companies, {
            totalSteps,
            finishedSteps,
        });
    }

    private static async updateStepResponsibilities(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct
    ) {
        const now = new Date();
        const organizationBasedResponsibilitiesWithRestriction = platform.config.responsibilities
        .filter(r => r.organizationBased && (r.minimumMembers || r.maximumMembers));

        const responsibilityIds = organizationBasedResponsibilitiesWithRestriction.map(r => r.id);

        const records = await MemberResponsibilityRecord.select()
            .where('responsibilityId', responsibilityIds)
            .where('organizationId', organization.id)
            .where(SQL.where('endDate', SQLWhereSign.Greater, now).or('endDate', null))
            .fetch();

        let totalSteps = 0;
        let finishedSteps = 0;

        const groups = await Group.getAll(organization.id, organization.periodId);

        const flatResponsibilities: {responsibility: MemberResponsibility, group: Group | null}[] = organizationBasedResponsibilitiesWithRestriction
        .flatMap(responsibility => {
            const defaultAgeGroupIds = responsibility.defaultAgeGroupIds;
            if(defaultAgeGroupIds === null) {
                const item: {responsibility: MemberResponsibility, group: Group | null} = {
                    responsibility,
                    group: null
                }
                return [item];
            }

            return groups
                .filter(g => g.defaultAgeGroupId !== null && defaultAgeGroupIds.includes(g.defaultAgeGroupId))
                .map(group => {
                    return {
                        responsibility,
                        group
                    }
                });
        });

        for(const {responsibility, group} of flatResponsibilities) {
            const { minimumMembers: min, maximumMembers: max } = responsibility;

            if (min === null && max === null) {
                continue;
            }

            totalSteps++;

            const responsibilityId = responsibility.id;
            let totalRecordsWithThisResponsibility = 0;

            if(group === null) {
                for (const record of records) {
                    if (record.responsibilityId === responsibilityId) {
                        totalRecordsWithThisResponsibility++;
                    }
                }
            } else {
                for (const record of records) {
                    if (record.responsibilityId === responsibilityId && record.groupId === group.id) {
                        totalRecordsWithThisResponsibility++;
                    }
                }
            }

            if (max !== null && totalRecordsWithThisResponsibility > max) {
                continue;
            }

            if (min !== null && totalRecordsWithThisResponsibility < min) {
                continue;
            }

            finishedSteps++;
        }

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
            if(emails.some(e => e.default)) {
                finishedSteps = 1;
            }

            setupSteps.update(SetupStepType.Emails, {
                totalSteps,
                finishedSteps,
            });

            setupSteps.markReviewed(SetupStepType.Emails, {userId: 'backend', userName: 'backend'});
    }

    private static updateStepPayment(setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct) {
            setupSteps.update(SetupStepType.Payment, {
                totalSteps: 0,
                finishedSteps: 0,
            });
    }
}
