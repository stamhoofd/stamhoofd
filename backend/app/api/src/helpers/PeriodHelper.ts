import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, Group as GroupStruct } from '@stamhoofd/structures';
import { PatchOrganizationRegistrationPeriodsEndpoint } from '../endpoints/organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint';
import { AuditLogService } from '../services/AuditLogService';
import { AuthenticatedStructures } from './AuthenticatedStructures';
import { SetupStepUpdater } from './SetupStepUpdater';

export class PeriodHelper {
    static async moveOrganizationToPeriod(organization: Organization, period: RegistrationPeriod) {
        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            console.log('moveOrganizationToPeriod', organization.id, period.id);
            await this.createOrganizationPeriodForPeriod(organization, period);
            organization.periodId = period.id;
            await organization.save();
        });
    }

    static async createOrganizationPeriodForPeriod(organization: Organization, period: RegistrationPeriod) {
        const oPeriods = await OrganizationRegistrationPeriod.where({ periodId: period.id, organizationId: organization.id }, { limit: 1 });

        if (oPeriods.length) {
            // Already created
            return oPeriods[0];
        }

        const currentPeriod = await organization.getPeriod();
        if (currentPeriod.periodId === period.id) {
            return currentPeriod;
        }

        const struct = await AuthenticatedStructures.organizationRegistrationPeriod(currentPeriod);

        const duplicate = struct.duplicate(period.getStructure());
        return await PatchOrganizationRegistrationPeriodsEndpoint.createOrganizationPeriod(organization, duplicate);
    }

    static async moveAllOrganizationsToPeriod(period: RegistrationPeriod) {
        const tag = 'moveAllOrganizationsToPeriod';
        if (QueueHandler.isRunning(tag)) {
            throw new SimpleError({
                code: 'move_period_pending',
                message: 'Er is al een jaarovergang bezig. Wacht tot deze klaar is.',
            });
        }

        await QueueHandler.schedule(tag, async () => {
            for await (const organization of Organization.select().all()) {
                try {
                    await this.moveOrganizationToPeriod(organization, period);
                }
                catch (error) {
                    console.error('Error moving organization to period', organization.id, error);
                }
            }
        });

        // When done: update setup steps
        await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod();
    }

    static async updateGroupsInPeriod(period: RegistrationPeriod) {
        const tag = 'updateGroupsInPeriod-' + period.id;

        if (QueueHandler.isRunning(tag)) {
            return;
        }

        console.log(tag);

        await QueueHandler.schedule(tag, async () => {
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                for await (const group of Group.select().where('periodId', period.id).all()) {
                    await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(GroupStruct.patch({ id: group.id }), period);
                }
            });
        });
    }
}
