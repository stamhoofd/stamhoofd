import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, MemberResponsibilityRecord, Organization, OrganizationRegistrationPeriod, Platform, RegistrationPeriod, SetupStepUpdater } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, Group as GroupStruct, PermissionLevel } from '@stamhoofd/structures';
import { PatchOrganizationRegistrationPeriodsEndpoint } from '../endpoints/organization/dashboard/registration-periods/PatchOrganizationRegistrationPeriodsEndpoint';
import { AuthenticatedStructures } from './AuthenticatedStructures';
import { MemberUserSyncer } from './MemberUserSyncer';
import { AuditLogService } from '../services/AuditLogService';

export class PeriodHelper {
    static async moveOrganizationToPeriod(organization: Organization, period: RegistrationPeriod) {
        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            console.log('moveOrganizationToPeriod', organization.id, period.id);
            await this.createOrganizationPeriodForPeriod(organization, period);
            organization.periodId = period.id;
            await organization.save();
        });
    }

    static async stopAllResponsibilities() {
        console.log('Stopping all responsibilities');
        const platform = await Platform.getSharedPrivateStruct();
        const keepPlatformResponsibilityIds = platform.config.responsibilities.filter(r => !r.organizationBased).map(r => r.id);
        const keepResponsibilityIds = platform.config.responsibilities.filter(r => !r.organizationBased || r.permissions?.level === PermissionLevel.Full).map(r => r.id);
        const batchSize = 100;

        let lastId = '';
        let c = 0;

        while (true) {
            const records = await MemberResponsibilityRecord.where(
                {
                    id: { sign: '>', value: lastId },
                    endDate: null,
                },
                {
                    limit: batchSize,
                    sort: ['id'],
                },
            );

            for (const record of records) {
                lastId = record.id;

                const invalid = keepPlatformResponsibilityIds.includes(record.responsibilityId) && record.organizationId;

                if (!keepResponsibilityIds.includes(record.responsibilityId) || invalid) {
                    record.endDate = new Date();
                    await record.save();
                    c++;
                }
            }

            if (records.length < batchSize) {
                break;
            }
        }

        console.log('Done: stopped all responsibilities: ' + c);
    }

    static async syncAllMemberUsers() {
        console.log('Syncing all members');

        let c = 0;
        let lastId: string = '';

        while (true) {
            const rawMembers = await Member.where({
                id: {
                    value: lastId,
                    sign: '>',
                },
            }, { limit: 500, sort: ['id'] });

            if (rawMembers.length === 0) {
                break;
            }

            const membersWithRegistrations = await Member.getBlobByIds(...rawMembers.map(m => m.id));

            const promises: Promise<any>[] = [];

            for (const memberWithRegistrations of membersWithRegistrations) {
                promises.push((async () => {
                    await MemberUserSyncer.onChangeMember(memberWithRegistrations);
                    c++;

                    if (c % 10000 === 0) {
                        console.log('Synced ' + c + ' members');
                    }
                })());
            }

            await Promise.all(promises);
            lastId = rawMembers[rawMembers.length - 1].id;
        }

        console.log('Done: synced all members: ' + c);
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

        const batchSize = 10;
        await QueueHandler.schedule(tag, async () => {
            let lastId = '';

            while (true) {
                const organizations = await Organization.where(
                    {
                        id: { sign: '>', value: lastId },
                    },
                    {
                        limit: batchSize,
                        sort: ['id'],
                    },
                );

                for (const organization of organizations) {
                    await this.moveOrganizationToPeriod(organization, period);
                    lastId = organization.id;
                }

                if (organizations.length < batchSize) {
                    break;
                }
            }

            await this.stopAllResponsibilities();
            await this.syncAllMemberUsers();
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

        const batchSize = 100;
        await QueueHandler.schedule(tag, async () => {
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                let lastId = '';

                while (true) {
                    const groups = await Group.where(
                        {
                            id: { sign: '>', value: lastId },
                            periodId: period.id,
                        },
                        {
                            limit: batchSize,
                            sort: ['id'],
                        },
                    );

                    for (const group of groups) {
                        await PatchOrganizationRegistrationPeriodsEndpoint.patchGroup(GroupStruct.patch({ id: group.id }), period);
                        lastId = group.id;
                    }

                    if (groups.length < batchSize) {
                        break;
                    }
                }
            });
        });
    }
}
