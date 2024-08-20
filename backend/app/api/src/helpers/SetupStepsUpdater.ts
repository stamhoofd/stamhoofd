import {
    Organization,
    OrganizationRegistrationPeriod,
    Platform,
} from "@stamhoofd/models";
import { QueueHandler } from "@stamhoofd/queues";
import { SetupStepType, SetupSteps } from "@stamhoofd/structures";

export class SetupStepUpdater {
    private static readonly STEP_TYPE_OPERATIONS: Record<SetupStepType, (setupSteps: SetupSteps,
        organization: Organization,
        platform: Platform) => void> = {
        [SetupStepType.Groups]: this.updateStepGroups,
        [SetupStepType.Premises]: this.updateStepPremises
    }

    static async updateSetupStepsForAllOrganizationsInCurrentPeriod({
        batchSize, platforms
    }: { batchSize?: number, platforms?: Platform[] } = {}) {
        const tag = 'updateSetupStepsForAllOrganizationsInCurrentPeriod';
        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            if(!platforms) {
                platforms = await Platform.all();
            }
    
            for (const platform of platforms) {
                const periodId = platform.periodId;
    
                let lastId = "";
    
                // eslint-disable-next-line no-constant-condition
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
    
                    for (const organizationRegistrationPeriod of organizationRegistrationPeriods) {
                        const organizationId =
                            organizationRegistrationPeriod.organizationId;
    
                        console.log(
                            "[FLAG-MOMENT] checking flag moments for " +
                                organizationId
                        );
                        const organization = await Organization.getByID(
                            organizationId
                        );
    
                        if (!organization) {
                            continue;
                        }
    
                        await SetupStepUpdater.updateFor(
                            organizationRegistrationPeriod,
                            platform,
                            organization,
                            stepTypes
                        );
                    }
    
                    lastId =
                        organizationRegistrationPeriods[
                            organizationRegistrationPeriods.length - 1
                        ].id;
                }
            }
        });
    }

    static async updateForOrganization(
        organization: Organization,
        {
            platform,
            organizationRegistrationPeriod
        }: {
            platform?: Platform;
            organizationRegistrationPeriod?: OrganizationRegistrationPeriod;
        } = {}
    ) {
        if (!platform) {
            platform = (await Platform.all())[0];
            if (!platform) {
                console.error("No platform not found");
                return;
            }
        }

        if (!organizationRegistrationPeriod) {
            const periodId = platform.periodId;
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
        platform: Platform,
        organization: Organization
    ) {
        const setupSteps = organizationRegistrationPeriod.setupSteps;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for(const stepType of Object.values(SetupStepType)) {
            console.log(`[STEP TYPE] ${stepType}`);
            const operation = this.STEP_TYPE_OPERATIONS[stepType];
            operation(setupSteps, organization, platform);
        }

        await organizationRegistrationPeriod.save();
    }

    static updateStepPremises(
        setupSteps: SetupSteps,
        organization: Organization,
        platform: Platform
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

            for(const premise of organization.privateMeta.premises) {
                if(premise.premiseTypeIds.includes(premiseTypeId)) {
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

    static updateStepGroups(setupSteps: SetupSteps,
        _organization: Organization,
        _platform: Platform) {
            setupSteps.update(SetupStepType.Groups, {
                totalSteps: 0,
                finishedSteps: 0
            });
    }
}
