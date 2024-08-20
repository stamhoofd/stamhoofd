import {
    Organization,
    OrganizationRegistrationPeriod,
    Platform,
} from "@stamhoofd/models";
import { QueueHandler } from "@stamhoofd/queues";
import {
    PlatformPremiseType,
    Platform as PlatformStruct,
    SetupStepType,
    SetupSteps,
} from "@stamhoofd/structures";

type SetupStepOperation = (setupSteps: SetupSteps, organization: Organization, platform: PlatformStruct) => void;

export class SetupStepUpdater {
    private static readonly STEP_TYPE_OPERATIONS: Record<
        SetupStepType,
        SetupStepOperation
    > = {
        [SetupStepType.Groups]: this.updateStepGroups,
        [SetupStepType.Premises]: this.updateStepPremises,
    };

    static async updateSetupStepsForAllOrganizationsInCurrentPeriod({
        batchSize, premiseTypes
    }: { batchSize?: number, premiseTypes?: PlatformPremiseType[] } = {}) {
        const tag = "updateSetupStepsForAllOrganizationsInCurrentPeriod";
        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            const platform = (await Platform.getSharedPrivateStruct()).clone();
            if(premiseTypes) {
                platform.config.premiseTypes = premiseTypes;
            }
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

    static async updateFor(
        organizationRegistrationPeriod: OrganizationRegistrationPeriod,
        platform: PlatformStruct,
        organization: Organization
    ) {
        const setupSteps = organizationRegistrationPeriod.setupSteps;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const stepType of Object.values(SetupStepType)) {
            console.log(`[STEP TYPE] ${stepType}`);
            const operation = this.STEP_TYPE_OPERATIONS[stepType];
            operation(setupSteps, organization, platform);
        }

        await organizationRegistrationPeriod.save();
    }

    static updateStepPremises(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: PlatformStruct
    ) {
        let totalSteps = 0;
        let finishedSteps = 0;

        const premiseTypes = platform.config.premiseTypes;

        for (const premiseType of premiseTypes) {
            const { min, max } = premiseType;
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

    static updateStepGroups(
        setupSteps: SetupSteps,
        _organization: Organization,
        _platform: PlatformStruct
    ) {
        setupSteps.update(SetupStepType.Groups, {
            totalSteps: 0,
            finishedSteps: 0,
        });
    }
}
