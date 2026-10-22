import { Platform } from '../models/Platform.js';
import { RegistrationPeriod } from '../models/RegistrationPeriod.js';

export class RegistrationPeriodService {
    static async updatePreviousNextPeriods(organizationId: string | null, existingReference?: RegistrationPeriod) {
        const allPeriods = await RegistrationPeriod.select().where('organizationId', organizationId).fetch();

        if (existingReference) {
            if (!existingReference.existsInDatabase) {
                allPeriods.push(existingReference);
            }
            else {
                const index = allPeriods.findIndex(p => p.id === existingReference.id);
                if (index !== -1) {
                    allPeriods[index] = existingReference;
                }
            }
        }

        allPeriods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        let previousPeriod: RegistrationPeriod | null = null;

        for (const period of allPeriods) {
            period.previousPeriodId = previousPeriod?.id ?? null;
            period.nextPeriodId = null;

            if (previousPeriod) {
                previousPeriod.nextPeriodId = period.id;
            }
            previousPeriod = period;
        }

        for (const period of allPeriods) {
            await period.save();
        }

        if (organizationId === null) {
            const platform = await Platform.getForEditing();
            await platform.setPreviousPeriodId();
            await platform.save();
        }
    }
}
