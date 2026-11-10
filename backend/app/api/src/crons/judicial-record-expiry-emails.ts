import { JudicialRecord, Member } from '@stamhoofd/models';
import { SQLWhereSign } from '@stamhoofd/sql';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordReviewStatus, JudicialRecordStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { JudicialRecordNotificationService } from '../services/judicial-record/JudicialRecordNotificationService.js';
import { JudicialRecordService } from '../services/judicial-record/JudicialRecordService.js';
import { registerTenantCron } from './helpers/registerTenantCron.js';

/** How long before a decision lapses the member is warned, in days. */
export const JUDICIAL_RECORD_EXPIRY_WARNING_DAYS = 30;

let lastRunDate: number | null = null;

registerTenantCron('judicialRecordExpiryEmails', judicialRecordExpiryEmails);

/**
 * Warn members whose approved extract is about to stop counting, once per record.
 *
 * Only approvals are warned about. A rejection that expires also returns the member to `Required`, but they
 * were already told to deliver another extract when it was refused, so there is nothing to announce.
 *
 * Run every night at 6 AM.
 */
export async function judicialRecordExpiryEmails() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return;
    }

    if (now.getHours() !== 6 && STAMHOOFD.environment !== 'development') {
        return;
    }

    await sendExpiryWarnings(now);

    lastRunDate = now.getDate();
}

export async function sendExpiryWarnings(now: Date): Promise<number> {
    // Expiry runs from the review date, so "expires within the warning window" is a plain comparison against
    // the review date and needs no date arithmetic in SQL.
    const reviewedBefore = Formatter.luxon(now)
        .plus({ days: JUDICIAL_RECORD_EXPIRY_WARNING_DAYS })
        .minus({ years: JUDICIAL_RECORD_VALIDITY_YEARS })
        .toJSDate();

    let sent = 0;

    for await (const records of JudicialRecord.select()
        .where('supersededAt', null)
        .where('expiryNotifiedAt', null)
        .where('reviewStatus', [JudicialRecordReviewStatus.Ok, JudicialRecordReviewStatus.ConditionallyAccepted])
        .where('reviewedAt', SQLWhereSign.LessEqual, reviewedBefore)
        .limit(50)
        .allBatched()) {
        const members = await Member.getByIDs(...records.map(record => record.memberId));

        for (const record of records) {
            const member = members.find(m => m.id === record.memberId);

            if (!member) {
                continue;
            }

            // A member who no longer holds a responsibility asking for an extract is not chased for one.
            const { status } = await JudicialRecordService.getRequirement(member);

            if (status !== JudicialRecordStatus.Required) {
                continue;
            }

            await JudicialRecordNotificationService.sendExpiryWarning(record, member);

            // Written whether or not an email went out: a member without an email address would otherwise be
            // reconsidered every night for the rest of the validity window.
            record.expiryNotifiedAt = new Date();
            await record.save();
            sent++;
        }
    }

    return sent;
}
