import { Platform } from '../models/Platform.js';
import { RegistrationPeriod } from '../models/RegistrationPeriod.js';

export class RegistrationPeriodService {
    static async updatePreviousNextPeriods(organizationId: string | null, existingReference?: RegistrationPeriod) {
        await RegistrationPeriod.updatePreviousNextPeriods(organizationId, existingReference);

        if (organizationId === null) {
            const platform = await Platform.getForEditing();
            await platform.setPreviousPeriodId();
            await platform.save();
        }
    }
}
