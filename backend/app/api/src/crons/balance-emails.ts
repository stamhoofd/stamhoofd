import { registerCron } from '@stamhoofd/crons';
import { Organization } from '@stamhoofd/models';

registerCron('balanceEmails', balanceEmails);

const limit = 10;
const lastOrganizationId = '';
const lastFullRun = new Date(0);

async function balanceEmails() {
    if (lastFullRun.getTime() > new Date().getTime() - 1000 * 60 * 60 * 12) {
        console.log('Already ran today, skipping.');
        return;
    }

    if ((new Date().getHours() > 10 || new Date().getHours() < 6) && STAMHOOFD.environment !== 'development') {
        console.log('Not between 6 and 10 AM, skipping.');
        return;
    }

    // Get the next x organization to send e-mails for
}
