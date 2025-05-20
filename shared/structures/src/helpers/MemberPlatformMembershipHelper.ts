import { MemberPlatformMembership } from '../members/MemberPlatformMembership';
import { ContinuousMembershipStatus, MembershipStatus } from '../members/MembershipStatus';

export class MemberPlatformMembershipHelper {
    static getStatus(memberships: MemberPlatformMembership[]) {
        let status = MembershipStatus.Inactive;
        const now = new Date();

        for (const membership of memberships) {
            if (membership.endDate && membership.endDate < now) {
                continue;
            }

            if (membership.startDate > now) {
                continue;
            }

            if (membership.expireDate && membership.expireDate < now) {
                if (status === MembershipStatus.Inactive) {
                    status = MembershipStatus.Expiring;
                }
                continue;
            }

            const isTemporary = membership.endDate.getTime() - membership.startDate.getTime() < 1000 * 60 * 60 * 24 * 31;

            if (status === MembershipStatus.Inactive || ((status === MembershipStatus.Expiring || status === MembershipStatus.Temporary) && !isTemporary)) {
                if (isTemporary) {
                    status = MembershipStatus.Temporary;
                }
                else {
                    if (membership.trialUntil && membership.trialUntil > now) {
                        status = MembershipStatus.Trial;
                    }
                    else {
                        status = MembershipStatus.Active;
                        break;
                    }
                }
            }
        }

        return status;
    }

    static getContinuousMembershipStatus({ memberships, start, end }: { memberships: MemberPlatformMembership[]; start: Date; end: Date }): ContinuousMembershipStatus {
        const sorted = memberships
            // filter memberships in period
            .filter(m => m.endDate > start && m.startDate < end)
            // sort by start date (earliest first)
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        // date until when there is a membership
        let coveredDate = start;

        for (const t of sorted) {
            if (t.startDate <= coveredDate) {
                if (t.endDate > coveredDate) {
                    coveredDate = t.endDate;
                }
            }
            // there is a gap -> partially covered
            else {
                return ContinuousMembershipStatus.Partial;
            }
        }

        if (coveredDate >= end) {
            return ContinuousMembershipStatus.Full;
        }

        // if there is at least one membership in the period
        if (sorted.length > 0) {
            return ContinuousMembershipStatus.Partial;
        }

        return ContinuousMembershipStatus.None;
    }

    static hasFutureMembership(memberships: MemberPlatformMembership[]): boolean {
        const now = new Date();
        return memberships.some(m => m.startDate > now);
    }
}
