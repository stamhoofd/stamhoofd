
import { Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from "@stamhoofd/models";
import { AuthenticatedStructures } from "./AuthenticatedStructures";
import { PatchOrganizationRegistrationPeriodsEndpoint } from "../endpoints/organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint";
import { QueueHandler } from "@stamhoofd/queues";
import { SetupStepUpdater } from "./SetupStepsUpdater";

export class PeriodHelper {
    static async moveOrganizationToPeriod(organization: Organization, period: RegistrationPeriod) {
        console.log('moveOrganizationToPeriod', organization.id, period.id)
        
        await this.createOrganizationPeriodForPeriod(organization, period)
        organization.periodId = period.id
        await organization.save()
    }

    static async createOrganizationPeriodForPeriod(organization: Organization, period: RegistrationPeriod) {
        const oPeriods = await OrganizationRegistrationPeriod.where({ periodId: period.id, organizationId: organization.id }, {limit: 1})
        
        if (oPeriods.length) {
            // Already created
            return oPeriods[0]
        }

        const currentPeriod = await organization.getPeriod()
        if (currentPeriod.periodId === period.id) {
            return currentPeriod
        }

        const struct = await AuthenticatedStructures.organizationRegistrationPeriod(currentPeriod)

        const duplicate = struct.duplicate(period.getStructure())
        return await PatchOrganizationRegistrationPeriodsEndpoint.createOrganizationPeriod(organization, duplicate)
    }

    static async moveAllOrganizationsToPeriod(period: RegistrationPeriod) {
        const tag = "moveAllOrganizationsToPeriod";
        const batchSize = 10;
        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            let lastId = "";

            while (true) {
                const organizations = await Organization.where(
                    {
                        id: { sign: ">", value: lastId },
                    },
                    { 
                        limit: batchSize, 
                        sort: ["id"] 
                    }
                );

                for (const organization of organizations) {
                    await this.moveOrganizationToPeriod(organization, period);
                    lastId = organization.id;
                }

                if (organizations.length < batchSize) {
                    break;
                }

            }
        });

        // When done: update setup steps
        await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod()
    }
}
