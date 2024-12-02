import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Member, MemberPlatformMembership, Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLWhereLike, scalarToSQLExpression } from '@stamhoofd/sql';

export class MemberNumberService {
    static async assignMemberNumber(member: Member, membership: MemberPlatformMembership) {
        if (member.details?.memberNumber) {
            console.log('Member already has member number, should not happen');
            return;
        }

        return await QueueHandler.schedule('assignMemberNumber', async function (this: undefined) {
            try {
                const memberNumber = await MemberNumberService.createMemberNumber(member, membership);
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
                        human: 'Er is iets misgegaan bij het aanmaken van het lidnummer.',
                    });
                }
            }
        });
    }

    static async createMemberNumber(member: Member, membership: MemberPlatformMembership): Promise<string> {
        // example: 5301-101012-1

        // #region get birth date part (ddmmjj)
        const birthDay = member.details?.birthDay;
        if (!birthDay) {
            throw new SimpleError({
                code: 'assign_member_number',
                message: 'Missing birthDay',
                human: 'Er kon geen lidnummer aangemaakt worden omdat er geen geboortedatum is ingesteld.',
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
                        human: 'Er kon geen uniek lidnummer aangemaakt worden. Mogelijks zijn er teveel leden met dezelfde geboortedatum. Neem contact op met de vereniging.',
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
}
