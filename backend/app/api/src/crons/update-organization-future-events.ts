/**
 * Recalculate the hasFutureEvents flag for all organizations.
 *
 * The flag can go stale over time: an event's end date passes without anyone
 * touching the organization, so it keeps reporting future events it no longer
 * has (or vice versa). Recomputing it nightly keeps it accurate.
 */

import { registerCron } from '@stamhoofd/crons';
import { Organization } from '@stamhoofd/models';

let lastRunDate: number | null = null;

registerCron('updateOrganizationFutureEvents', updateOrganizationFutureEvents);

function shouldRun() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return false;
    }

    const hour = now.getHours();

    // between 3 and 5 AM - except in development
    if ((hour < 3 || hour >= 5) && STAMHOOFD.environment !== 'development') {
        return false;
    }

    return true;
}

async function updateOrganizationFutureEvents() {
    if (!shouldRun()) {
        return;
    }

    lastRunDate = new Date().getDate();

    console.log('Updating hasFutureEvents for all organizations...');
    await Organization.updateFutureEventsForOrganizations('all');
}
