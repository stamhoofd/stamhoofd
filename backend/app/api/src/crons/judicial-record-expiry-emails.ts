import { JudicialRecord, Member } from '@stamhoofd/models';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordReviewDecision, JudicialRecordStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { JudicialRecordNotificationService } from '../services/judicial-record/JudicialRecordNotificationService.js';
import { JudicialRecordService } from '../services/judicial-record/JudicialRecordService.js';
import { registerTenantCron } from './helpers/registerTenantCron.js';

/** How long before a decision lapses the member is warned, in days. */
export const JUDICIAL_RECORD_EXPIRY_WARNING_DAYS = 30;

let lastRunDate: number | null = null;

registerTenantCron('judicialRecordExpiryEmails', judicialRecordExpiryEmails);

/**
 * Tell members whose approved extract stopped counting, once per record per cause.
 *
 * Both causes are read from the record rather than from an event, because neither is one: a decision lapses
 * by the calendar, and an identity stops matching when somebody edits a name somewhere else entirely.
 *
 * Only approvals are announced. A rejection that lapses or drifts also returns the member to `Required`, but
 * they were already told to deliver another extract when it was refused, so there is nothing to announce.
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
    await sendIdentityChangedNotices();

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
        .where('expiryNotifiedAt', null)
        .where('reviewDecision', [JudicialRecordReviewDecision.Ok, JudicialRecordReviewDecision.ConditionallyAccepted])
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

            // An approval granted to a name the member no longer has already stopped counting, so announcing
            // that it expires in a month would describe a deadline that is not the one blocking them.
            if (record.identityHash !== member.judicialIdentityHash) {
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

export async function sendIdentityChangedNotices(): Promise<number> {
    let sent = 0;

    // The mismatch is filtered in SQL rather than in the loop, so the sweep reads the records that drifted
    // instead of every approval in existence every night.
    for await (const records of JudicialRecord.select()
        .join(
            SQL.join(Member.table)
                .where(SQL.column(Member.table, 'id'), SQL.column(JudicialRecord.table, 'memberId'))
                .andWhere(SQL.column(JudicialRecord.table, 'identityHash'), '!=', SQL.column(Member.table, 'judicialIdentityHash')),
        )
        .where('identityNotifiedAt', null)
        .where('reviewDecision', [JudicialRecordReviewDecision.Ok, JudicialRecordReviewDecision.ConditionallyAccepted])
        .limit(50)
        .allBatched()) {
        const members = await Member.getByIDs(...records.map(record => record.memberId));

        for (const record of records) {
            const member = members.find(m => m.id === record.memberId);

            if (!member) {
                continue;
            }

            const { status } = await JudicialRecordService.getRequirement(member);

            if (status !== JudicialRecordStatus.Required) {
                continue;
            }

            await JudicialRecordNotificationService.sendIdentityChanged(record, member);

            record.identityNotifiedAt = new Date();
            await record.save();
            sent++;
        }
    }

    return sent;
}
