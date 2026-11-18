import { BelcotaxSubmissionService } from '../services/belcotax/BelcotaxSubmissionService.js';
import { registerTenantCron } from './helpers/registerTenantCron.js';

registerTenantCron('belcotaxSubmissions', belcotaxSubmissions);

/**
 * Asks Belcotax for the result of submissions that are still being checked, after the follow-up right after the
 * submission stopped (or the process restarted). Gives up after 24 hours. Never submits anything itself.
 */
export async function belcotaxSubmissions() {
    await BelcotaxSubmissionService.pollOpenSubmissions();
}
