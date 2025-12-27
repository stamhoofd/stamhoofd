import { QueryableModel, SQL } from '@stamhoofd/sql';
import {
    Address,
    BooleanStatus,
    Gender,
    MemberDetails,
    Parent,
    ParentType,
    RecordAnswer,
    UitpasNumberDetails,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import {
    BalanceItem,
    Document,
    Member,
    MemberPlatformMembership,
    MemberResponsibilityRecord,
    MergedMember,
    Registration,
    User,
} from '../models/index.js';

export async function mergeMultipleMembers(members: Member[]) {
    const { base, others } = selectBaseMember(members);

    if (!base.existsInDatabase) {
        throw Error('Base member does not exist in database');
    }

    for (const other of others) {
        await mergeTwoMembers(base, other);
    }
}

export async function findEqualMembers({
    firstName,
    lastName,
    birthDay,
}: {
    firstName: string;
    lastName: string;
    birthDay: string;
}): Promise<Member[]> {
    return await Member.where({
        firstName,
        lastName,
        birthDay,
    });
}

export async function mergeTwoMembers(base: Member, other: Member): Promise<void> {
    console.log('Merging two member', base.id, other.id, base.details.name, other.details.name);

    if (base.id === other.id) {
        throw new Error('Cannot merge the same member');
    }

    if (!base.existsInDatabase) {
        throw new Error('Cannot merge to base member that does not exist in database');
    }

    mergeMemberDetails(base, other);

    if (other.existsInDatabase) {
        await mergeRegistrations(base, other);
        await mergeUsers(base, other);
        await mergeResponsibilities(base, other);
        await mergeBalanceItems(base, other);
        await mergeDocuments(base, other);
        await mergeMemberPlatformMemberships(base, other);
    }

    // Force review of all details
    base.details.reviewTimes.clearAll();
    base.details.cleanData();

    if (other.existsInDatabase && other.details.memberNumber && other.details.memberNumber === base.details.memberNumber) {
        // Clear member number first, because that will cause duplicate member number mysql errors
        other.details.memberNumber = null;
        await other.save();
    }

    await base.save();

    if (other.existsInDatabase) {
        console.log('Deleting duplicate member', other.id, other.details.name);

        // store other member in merged_member table
        const mergedMember = MergedMember.fromMember(other, base.id);
        await mergedMember.save();

        await other.delete();
    }
}

async function mergeRegistrations(base: Member, other: Member) {
    await mergeModels(base, other, Registration);
}

async function mergeUsers(base: Member, other: Member) {
    await mergeModels(base, other, User);
}

async function mergeResponsibilities(base: Member, other: Member) {
    async function getResponsibilities(memberId: string) {
        const rows = await SQL.select()
            .from(SQL.table(MemberResponsibilityRecord.table))
            .where(SQL.column('memberId'), memberId)
            .fetch();

        return MemberResponsibilityRecord.fromRows(
            rows,
            MemberResponsibilityRecord.table,
        );
    }

    const otherResponsibilities = await getResponsibilities(other.id);
    const baseResponsibilities = await getResponsibilities(base.id);

    // Delete duplicate responsibilities where endDate is null -> keep responsibility with oldest start date
    for (const otherResponsibility of otherResponsibilities) {
        // check if equal responsibilities exist
        const otherResponsibilitiesWithoutCurrent
            = otherResponsibilities.filter(
                o => o.id !== otherResponsibility.id,
            );
        const equalResponsibilities = baseResponsibilities
            .concat(otherResponsibilitiesWithoutCurrent)
            .filter((baseResponsibility) => {
                return (
                    baseResponsibility.responsibilityId
                    === otherResponsibility.responsibilityId
                    && baseResponsibility.organizationId
                    === otherResponsibility.organizationId
                    && baseResponsibility.groupId
                    === otherResponsibility.groupId
                    && baseResponsibility.endDate === null
                    && otherResponsibility.endDate === null
                );
            });

        if (equalResponsibilities.length > 0) {
            const allEqualResponsibilities = [
                ...equalResponsibilities,
                otherResponsibility,
            ]
                // sort on startDate
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

            const responsibilityWithOldestStartDate
                = allEqualResponsibilities[0];

            const responsibilitiesToDelete = allEqualResponsibilities.slice(
                1,
                undefined,
            );

            for (const responsibilityToDelete of responsibilitiesToDelete) {
                const baseIndex = baseResponsibilities.indexOf(
                    responsibilityToDelete,
                );
                if (baseIndex !== -1) baseResponsibilities.splice(baseIndex, 1);
                else {
                    const otherIndex = otherResponsibilities.indexOf(
                        responsibilityToDelete,
                    );
                    if (otherIndex !== -1)
                        otherResponsibilities.splice(otherIndex, 1);
                }

                if (responsibilityToDelete.existsInDatabase) {
                    await responsibilityToDelete.delete();
                }
            }

            if (responsibilityWithOldestStartDate.memberId !== base.id) {
                responsibilityWithOldestStartDate.memberId = base.id;
                await responsibilityWithOldestStartDate.save();
            }
        }
        else {
            otherResponsibility.memberId = base.id;
            await otherResponsibility.save();
        }
    }
}

async function mergeBalanceItems(base: Member, other: Member) {
    await mergeModels(base, other, BalanceItem);
}

async function mergeDocuments(base: Member, other: Member) {
    await mergeModels(base, other, Document);
}

async function mergeMemberPlatformMemberships(base: Member, other: Member) {
    await mergeModels(base, other, MemberPlatformMembership);
}

class ModelWithMemberId extends QueryableModel {
    memberId: string | null;
}

async function mergeModels<M extends typeof ModelWithMemberId>(
    base: Member,
    other: Member,
    model: M,
) {
    const baseId = base.id;
    const otherModels = await model.where({
        memberId: other.id,
    });

    for (const otherModel of otherModels) {
        otherModel.memberId = baseId;
        await otherModel.save();
    }
}

export function mergeMemberDetails(base: Member, other: Member): void {
    const baseDetails = base.details;
    const otherDetails = other.details;
    baseDetails.cleanData();
    otherDetails.cleanData();

    // string details
    mergeStringIfBaseNotSet(baseDetails, otherDetails, 'firstName');
    mergeStringIfBaseNotSet(baseDetails, otherDetails, 'lastName');

    mergeStringIfBaseNotSet(baseDetails, otherDetails, 'memberNumber');

    // uitpas number
    mergeUitpasNumberDetails(baseDetails, otherDetails, baseDetails);

    // email
    mergeEmail(baseDetails, otherDetails);

    // phone
    mergePhone(baseDetails, otherDetails, baseDetails);

    // gender
    if (otherDetails.gender !== Gender.Other) {
        baseDetails.gender = otherDetails.gender;
    }

    // notes
    mergeNotes(baseDetails, otherDetails);

    // date
    merge(baseDetails, otherDetails, 'birthDay');

    // boolean status
    mergeBooleanStatusIfBaseNotSet(
        baseDetails,
        otherDetails,
        'requiresFinancialSupport',
    );

    mergeBooleanStatusIfBaseNotSet(
        baseDetails,
        otherDetails,
        'dataPermissions',
    );

    // address
    mergeAddress(baseDetails, otherDetails, baseDetails);

    // parents
    mergeParents(baseDetails, otherDetails);

    // emergency contacts
    baseDetails.emergencyContacts = baseDetails.emergencyContacts.concat(
        // add contacts that are not yet in the list
        otherDetails.emergencyContacts.filter(
            otherContact =>
                !baseDetails.emergencyContacts.some(baseContact =>
                    baseContact.isEqual(otherContact),
                ),
        ),
    );

    // review times
    // todo: is this correct?
    baseDetails.reviewTimes.merge(otherDetails.reviewTimes);

    // answers
    mergeAnswers(baseDetails, otherDetails);

    // unverified data
    baseDetails.unverifiedEmails = Formatter.uniqueArray(
        baseDetails.unverifiedEmails.concat(
            otherDetails.unverifiedEmails.filter(
                email => !isNullOrEmpty(email),
            ),
        ),
    );
    baseDetails.unverifiedPhones = Formatter.uniqueArray(
        baseDetails.unverifiedPhones.concat(
            otherDetails.unverifiedPhones.filter(
                phone => !isNullOrEmpty(phone),
            ),
        ),
    );

    // unverified addresses
    for (const address of otherDetails.unverifiedAddresses) {
        if (!baseDetails.unverifiedAddresses.some(a => a.id === address.id)) {
            baseDetails.unverifiedAddresses.push(address);
        }
    }

    // Ids
    baseDetails.oldIds = Formatter.uniqueArray([...baseDetails.oldIds, ...otherDetails.oldIds]).filter(b => b !== base.id);

    if (other.id) {
        baseDetails.oldIds = Formatter.uniqueArray([...baseDetails.oldIds, other.id]);
    }
}

export function selectBaseMember(members: Member[]): {
    base: Member;
    others: Member[];
} {
    if (members.length < 2) {
        throw Error('Members array length is less than 2.');
    }
    const sorted = members.sort(
        (m1, m2) => (m2.existsInDatabase ? 0 : m2.createdAt.getTime()) - (m1.existsInDatabase ? 0 : m1.createdAt.getTime()),
    );

    return { base: sorted[0], others: sorted.slice(1, undefined) };
}

function mergeAnswers(base: MemberDetails, other: MemberDetails) {
    const newAnswers: Map<string, RecordAnswer> = new Map(base.recordAnswers);
    for (const otherAnswer of other.recordAnswers.values()) {
        const otherId = otherAnswer.settings.id;
        const baseAnswer = newAnswers.get(otherId);

        if (!baseAnswer) {
            newAnswers.set(otherId, otherAnswer);
        }
        else if (otherAnswer.date >= baseAnswer.date) {
            newAnswers.set(otherId, otherAnswer);
        }
        else {
            // keep existing, this one is more up-to-date, don't add the other answer
        }
    }
    base.recordAnswers = newAnswers;
}

function mergeNotes(base: MemberDetails, other: MemberDetails) {
    if (base.notes && other.notes && base.notes !== other.notes) {
        base.notes = `${base.notes}\n${other.notes}`;
    }
    else if (other.notes) {
        base.notes = other.notes;
        return;
    }
}

function mergeParents(base: MemberDetails, other: MemberDetails) {
    const baseParents = base.parents;
    const otherParents = other.parents;
    const parentsToAdd: Parent[] = [];

    for (const otherParent of otherParents) {
        // equal if same first and last name
        const equalBaseParent = baseParents.find(
            baseParent =>
                hasEqualStringValue(baseParent, otherParent, 'firstName')
                && hasEqualStringValue(baseParent, otherParent, 'lastName'),
        );

        if (!equalBaseParent) {
            parentsToAdd.push(otherParent);
            continue;
        }

        mergeParent(equalBaseParent, otherParent, base);
    }

    base.parents = baseParents.concat(parentsToAdd);
}

function mergeParent(base: Parent, other: Parent, baseDetails: MemberDetails) {
    if (other.type !== ParentType.Other) {
        base.type = other.type;
    }
    mergeString(base, other, 'firstName');
    mergeString(base, other, 'lastName');
    // add other emails to alternative emails
    mergeEmail(base, other);
    mergePhone(base, other, baseDetails);
    mergeAddress(base, other, baseDetails);
}

function mergeEmail(
    base: { email: string | null; alternativeEmails: string[] },
    other: { email: string | null; alternativeEmails: string[] },
) {
    const allEmails = Formatter.uniqueArray(
        [other.email, ...other.alternativeEmails, base.email, ...base.alternativeEmails]
            .filter(f => f !== null)
            .filter(f => !isNullOrEmpty(f)),
    );
    base.email = allEmails.shift() ?? null;
    base.alternativeEmails = allEmails;
}

function mergePhone(
    base: { phone: string | null | undefined },
    other: { phone: string | null | undefined },
    baseDetails: MemberDetails,
) {
    const originalPhone = base.phone;
    const isPhoneMerged = mergeString(base, other, 'phone');
    if (isPhoneMerged && !isNullOrEmpty(originalPhone)) {
        if (
            !baseDetails.unverifiedPhones.some(phone => phone === originalPhone)
        ) {
            baseDetails.unverifiedPhones.push(originalPhone!);
        }
    }
}

function mergeAddress(
    base: { address: Address | null | undefined },
    other: { address: Address | null | undefined },
    baseDetails: MemberDetails,
) {
    const baseAddress = base.address;
    const otherAddress = other.address;

    if (!otherAddress) {
        return;
    }

    base.address = otherAddress;

    if (baseAddress && baseAddress.id !== otherAddress.id) {
        // add base address to unverified addresses
        if (
            !baseDetails.unverifiedAddresses.some(
                address => address.id === baseAddress.id,
            )
        ) {
            baseDetails.unverifiedAddresses.push(baseAddress);
        }
    }
}

// todo: test
function mergeUitpasNumberDetails(base: { uitpasNumberDetails: UitpasNumberDetails | null }, other: { uitpasNumberDetails: UitpasNumberDetails | null }, baseDetails: MemberDetails) {
    const baseUitpasNumberDetails = base.uitpasNumberDetails;
    const otherUitpasNumberDetails = other.uitpasNumberDetails;

    if (!otherUitpasNumberDetails) {
        return;
    }

    if ((baseUitpasNumberDetails?.socialTariff?.updatedAt.getTime() ?? 0) >= (otherUitpasNumberDetails.socialTariff?.updatedAt.getTime() ?? 0)) {
        return;
    }

    baseDetails.uitpasNumberDetails = otherUitpasNumberDetails;
}

function mergeString<T, K extends keyof T>(
    base: T,
    other: T,
    key: K & (T[K] extends string | null | undefined ? K : never),
): boolean {
    const otherValue = other[key] as string | null | undefined;
    if (isNullOrEmpty(otherValue)) {
        return false;
    }

    (base[key] as string | null | undefined) = otherValue;

    return true;
}

function mergeStringIfBaseNotSet<T, K extends keyof T>(
    base: T,
    other: T,
    key: K & (T[K] extends string | null | undefined ? K : never),
): boolean {
    const otherValue = other[key] as string | null | undefined;
    if (isNullOrEmpty(otherValue)) {
        return false;
    }

    if (!isNullOrEmpty(base[key] as string | null | undefined)) {
        return false;
    }

    (base[key] as string | null | undefined) = otherValue;

    return true;
}

function merge<T, K extends keyof T>(
    base: T,
    other: T,
    key: K &
        (T[K] extends number | Date | boolean | null | undefined ? K : never),
): boolean {
    const otherValue = other[key] as number | Date | boolean | null | undefined;
    if (otherValue === null || otherValue === undefined) return false;
    (base[key] as number | Date | boolean | null | undefined) = otherValue;
    return true;
}

function mergeBooleanStatusIfBaseNotSet<T, K extends keyof T>(
    base: T,
    other: T,
    key: K & (T[K] extends BooleanStatus | null | undefined ? K : never),
): boolean {
    const otherValue = other[key] as BooleanStatus | null | undefined;
    if (otherValue === null || otherValue === undefined) return false;

    const baseValue = base[key] as BooleanStatus | null | undefined;
    if (baseValue === undefined || baseValue === null) {
        (base[key] as BooleanStatus | null | undefined) = otherValue;
        return true;
    }

    if (baseValue.date < otherValue.date) {
        (base[key] as BooleanStatus | null | undefined) = otherValue;
        return true;
    }

    return false;
}

/**
 * Returns true if the values of the key for a and b
 * are not null or undefined
 * and both are equal.
 * @param a
 * @param b
 * @param key
 * @returns
 */
function hasEqualStringValue<T, K extends keyof T>(
    a: T,
    b: T,
    key: K & (T[K] extends string | null | undefined ? K : never),
) {
    return hasValueAndIsEqual(
        a[key] as string | null | undefined,
        b[key] as string | null | undefined,
    );
}

function hasValueAndIsEqual(
    a: string | null | undefined,
    b: string | null | undefined,
): boolean {
    if (isNullOrEmpty(a) || isNullOrEmpty(b)) return false;
    return isStringEqual(a as string, b as string);
}

function isStringEqual(a: string, b: string): boolean {
    return toLowerTrim(a) === toLowerTrim(b);
}

function toLowerTrim(name: string) {
    return name.toLowerCase().trim();
}

function isNullOrEmpty(value: string | null | undefined) {
    return value === null || value === undefined || value.trim() === '';
}
