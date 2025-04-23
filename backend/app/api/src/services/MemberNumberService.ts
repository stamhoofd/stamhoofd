import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Member, MemberPlatformMembership, Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { scalarToSQLExpression, SQL, SQLCharLength, SQLWhereLike } from '@stamhoofd/sql';

export class MemberNumberService {
    static async assignMemberNumber(member: Member, membership: MemberPlatformMembership) {
        if (member.details?.memberNumber) {
            console.log('Member already has member number, should not happen');
            return;
        }

        if (!STAMHOOFD.MEMBER_NUMBER_ALGORITHM) {
            console.warn('No member number algorithm set. Please set STAMHOOFD.MEMBER_NUMBER_ALGORITHM in the environment.');
            return;
        }

        return await QueueHandler.schedule('assignMemberNumber', async function (this: undefined) {
            try {
                const memberNumber = await MemberNumberService.createMemberNumber(member, membership);

                if (memberNumber === undefined) {
                    console.warn('No valid member number algorithm set. Please set a valid STAMHOOFD.MEMBER_NUMBER_ALGORITHM in the environment.');
                    return;
                }

                member.details.memberNumber = memberNumber;
                await member.save();
            }
            catch (error) {
                if (isSimpleError(error) || isSimpleErrors(error)) {
                    throw error;
                }
                else {
                    console.error(error);
                    throw new SimpleError({
                        code: 'assign_member_number',
                        message: error.message,
                        human: $t(`3a2c3e9d-4ac8-44a1-9690-98e8e4623298`),
                    });
                }
            }
        });
    }

    private static async createMemberNumber(member: Member, membership: MemberPlatformMembership): Promise<string | undefined> {
        if (STAMHOOFD.MEMBER_NUMBER_ALGORITHM === MemberNumberAlgorithm.Incremental) {
            return this.createIncrementalMemberNumber();
        }
        else if (STAMHOOFD.MEMBER_NUMBER_ALGORITHM === MemberNumberAlgorithm.KSA) {
            return this.createKSAMemberNumber(member, membership);
        }
    }

    private static async createKSAMemberNumber(member: Member, membership: MemberPlatformMembership): Promise<string> {
        // example: 5301-101012-1

        // #region get birth date part (ddmmjj)
        const birthDay = member.details?.birthDay;
        if (!birthDay) {
            throw new SimpleError({
                code: 'assign_member_number',
                message: 'Missing birthDay',
                human: $t(`3e6429f3-1fc2-42ad-b585-4da7da164267`),
            });
        }

        const dayPart = birthDay.getDate().toString().padStart(2, '0');
        const monthPart = (birthDay.getMonth() + 1).toString().padStart(2, '0');
        const yearPart = birthDay.getFullYear().toString().slice(2, 4);
        const birthDatePart = `${dayPart}${monthPart}${yearPart}`;
        // #endregion

        // #region get group number
        const organizationId = membership.organizationId;
        const organization = await Organization.getByID(organizationId);
        if (!organization) {
            throw new Error(`Organization with id ${organizationId} not found`);
        }
        const groupNumber = organization.uri;
        // #endregion

        // #region get follow up number
        const firstPart = `${groupNumber}-${birthDatePart}-`;

        const query = SQL.select()
            .from(SQL.table('members'))
            .where(
                new SQLWhereLike(
                    SQL.column('members', 'memberNumber'),
                    scalarToSQLExpression(`${SQLWhereLike.escape(firstPart)}%`),
                ),
            );

        const count = await query.count();
        console.log(`Found ${count} members with a memberNumber starting with ${firstPart}`);

        let followUpNumber = count;
        // #endregion

        // #region check if memberNumber is unique
        let doesExist = true;
        let memberNumber: string = '';
        let tries = 0;

        while (doesExist) {
            followUpNumber++;
            memberNumber = firstPart + followUpNumber;

            const result = await SQL.select()
                .from(SQL.table('members'))
                .where(
                    SQL.column('members', 'memberNumber'),
                    scalarToSQLExpression(memberNumber),
                )
                .first(false);

            console.log(`Is ${memberNumber} unique? ${result === null}`);

            if (result !== null) {
                tries++;
                if (tries > 9) {
                    throw new SimpleError({
                        code: 'assign_member_number',
                        message: `Duplicate member numbers (last try: ${memberNumber}, tries: ${tries})`,
                        human: $t(`49742012-1ca8-4b91-a176-9ce3e17c1fe0`),
                    });
                }
            }
            else {
                doesExist = false;
            }
        }
        // #endregion

        console.log(`Created member number: ${memberNumber}`);

        return memberNumber;
    }

    private static largestMemberNumberCache: number | null = null;

    private static async createIncrementalMemberNumber(): Promise<string> {
        const requiredLength = STAMHOOFD.MEMBER_NUMBER_ALGORITHM_LENGTH; // Required for reliable sorting (sorting strings with different length will cause unexpected results)

        if (!requiredLength || typeof requiredLength !== 'number') {
            throw new Error('When using the Incremental member number algorithm, you need to set STAMHOOFD.MEMBER_NUMBER_ALGORITHM_LENGTH in the environment.');
        }

        let nextNumber = 1;

        if (this.largestMemberNumberCache !== null) {
            nextNumber = this.largestMemberNumberCache + 1;
        }
        else {
            // Find largest member number in the database
            // The required length prevents string-sorting with different lengths, causing an unexpected order
            const query = await SQL.select('memberNumber')
                .from(SQL.table('members'))
                .where(
                    new SQLCharLength(SQL.column('memberNumber')),
                    requiredLength,
                )
                .limit(1)
                .orderBy('memberNumber', 'DESC')
                .fetch();

            const largestMemberNumber = query[0]?.['members']?.['memberNumber'];

            if (largestMemberNumber && typeof largestMemberNumber === 'string') {
                const parsed = parseInt(largestMemberNumber);
                if (!isNaN(parsed)) {
                    nextNumber = parsed + 1;
                }
            }
        }

        this.largestMemberNumberCache = nextNumber;
        const str = nextNumber.toString().padStart(requiredLength, '0');

        if (str.length !== requiredLength) {
            throw new Error('Reached maximum member number length ' + str);
        }

        return str;
    }
}
