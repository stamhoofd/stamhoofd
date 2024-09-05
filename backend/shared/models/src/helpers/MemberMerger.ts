import { Model } from "@simonbackx/simple-database";
import { SQL } from "@stamhoofd/sql";
import {
    Address,
    BooleanStatus,
    Gender,
    MemberDetails,
    Parent,
    ParentType,
    RecordAnswer,
} from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import {
    BalanceItem,
    Document,
    Member,
    MemberPlatformMembership,
    MemberResponsibilityRecord,
    MergedMember,
    Registration,
    User,
} from "../models";

export async function mergeMultipleMembers(members: Member[]) {
    const { base, others } = selectBaseMember(members);

    if (!base.existsInDatabase) {
        throw Error("Base member does not exist in database")
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
    console.log('Merging two member', base.id, other.id, base.details.name, other.details.name)

    if (base.id === other.id) {
        throw new Error('Cannot merge the same member')
    }

    if (!base.existsInDatabase) {
        throw new Error('Cannot merge to base member that does not exist in database')
    }

    mergeMemberDetails(base, other);

    await mergeRegistrations(base, other);
    await mergeUsers(base, other);
    await mergeResponsibilities(base, other);
    await mergeBalanceItems(base, other);
    await mergeDocuments(base, other);
    await mergeMemberPlatformMemberships(base, other);

    // Force review of all details
    base.details.reviewTimes.clearAll();

    await base.save();

    if (other.existsInDatabase) {
        console.log('Deleting duplicate member', other.id, other.details.name)

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
            .where(SQL.column("memberId"), memberId)
            .fetch();

        return MemberResponsibilityRecord.fromRows(
            rows,
            MemberResponsibilityRecord.table
        );
    }

    const otherResponsibilities = await getResponsibilities(other.id);
    const baseResponsibilities = await getResponsibilities(base.id);

    // Delete duplicate responsibilities where endDate is null -> keep responsibility with oldest start date
    for (const otherResponsibility of otherResponsibilities) {
        // check if equal responsibilities exist
        const otherResponsibilitiesWithoutCurrent =
            otherResponsibilities.filter(
                (o) => o.id !== otherResponsibility.id
            );
        const equalResponsibilities = baseResponsibilities
            .concat(otherResponsibilitiesWithoutCurrent)
            .filter((baseResponsibility) => {
                return (
                    baseResponsibility.responsibilityId ===
                        otherResponsibility.responsibilityId &&
                    baseResponsibility.organizationId ===
                        otherResponsibility.organizationId &&
                    baseResponsibility.groupId ===
                        otherResponsibility.groupId &&
                    baseResponsibility.endDate === null &&
                    otherResponsibility.endDate === null
                );
            });

        if (equalResponsibilities.length > 0) {
            const allEqualResponsibilities = [
                ...equalResponsibilities,
                otherResponsibility,
            ]
                // sort on startDate
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

            const responsibilityWithOldestStartDate =
                allEqualResponsibilities[0];

            const responsibilitiesToDelete = allEqualResponsibilities.slice(
                1,
                undefined
            );

            for (const responsibilityToDelete of responsibilitiesToDelete) {
                const baseIndex = baseResponsibilities.indexOf(
                    responsibilityToDelete
                );
                if (baseIndex !== -1) baseResponsibilities.splice(baseIndex, 1);
                else {
                    const otherIndex = otherResponsibilities.indexOf(
                        responsibilityToDelete
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
        } else {
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

class ModelWithMemberId extends Model {
    memberId: string | null;
}

async function mergeModels<M extends typeof ModelWithMemberId>(
    base: Member,
    other: Member,
    model: M
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
    mergeStringIfBaseNotSet(baseDetails, otherDetails, "firstName");
    mergeStringIfBaseNotSet(baseDetails, otherDetails, "lastName");

    mergeStringIfBaseNotSet(baseDetails, otherDetails, "memberNumber");
    mergeStringIfBaseNotSet(baseDetails, otherDetails, "uitpasNumber");

    // email
    mergeEmail(baseDetails, otherDetails);

    // phone
    mergePhone(baseDetails, otherDetails, baseDetails);

    // gender
    if (baseDetails.gender === Gender.Other) {
        baseDetails.gender = otherDetails.gender;
    }

    // notes
    mergeNotes(baseDetails, otherDetails);

    // date
    mergeIfBaseNotSet(baseDetails, otherDetails, "birthDay");

    // boolean status
    mergeBooleanStatusIfBaseNotSet(
        baseDetails,
        otherDetails,
        "requiresFinancialSupport"
    );

    mergeBooleanStatusIfBaseNotSet(
        baseDetails,
        otherDetails,
        "dataPermissions"
    );

    // address
    mergeAddress(baseDetails, otherDetails, baseDetails);

    // parents
    mergeParents(baseDetails, otherDetails);

    // emergency contacts
    baseDetails.emergencyContacts = baseDetails.emergencyContacts.concat(
        // add contacts that are not yet in the list
        otherDetails.emergencyContacts.filter(
            (otherContact) =>
                !baseDetails.emergencyContacts.some((baseContact) =>
                    baseContact.isEqual(otherContact)
                )
        )
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
                (email) => !isNullOrEmpty(email)
            )
        )
    );
    baseDetails.unverifiedPhones = Formatter.uniqueArray(
        baseDetails.unverifiedPhones.concat(
            otherDetails.unverifiedPhones.filter(
                (phone) => !isNullOrEmpty(phone)
            )
        )
    );

    // unverified addresses
    for (const address of otherDetails.unverifiedAddresses) {
        if (!baseDetails.unverifiedAddresses.some((a) => a.id === address.id)) {
            baseDetails.unverifiedAddresses.push(address);
        }
    }
}

export function selectBaseMember(members: Member[]): {
    base: Member;
    others: Member[];
} {
    if (members.length < 2) {
        throw Error("Members array length is less than 2.");
    }
    const sorted = members.sort(
        (m1, m2) => (m2.existsInDatabase ? 0 : m2.createdAt.getTime()) - (m1.existsInDatabase ? 0 : m1.createdAt.getTime())
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
        } else if (otherAnswer.date >= baseAnswer.date) {
            newAnswers.set(otherId, otherAnswer);
        } else {
            // keep existing, this one is more up-to-date, don't add the other answer
        }
    }
    base.recordAnswers = newAnswers;
}

function mergeNotes(base: MemberDetails, other: MemberDetails) {
    if (base.notes && other.notes) {
        base.notes = `${base.notes}\n${other.notes}`;
    } else if (base.notes) {
        return;
    } else {
        base.notes = other.notes;
    }
}

function mergeParents(base: MemberDetails, other: MemberDetails) {
    const baseParents = base.parents;
    const otherParents = other.parents;
    const parentsToAdd: Parent[] = [];

    for (const otherParent of otherParents) {
        // equal if same first and last name
        const equalBaseParent = baseParents.find(
            (baseParent) =>
                hasEqualStringValue(baseParent, otherParent, "firstName") &&
                hasEqualStringValue(baseParent, otherParent, "lastName")
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
    if (base.type === ParentType.Other) {
        base.type = other.type;
    }
    mergeStringIfBaseNotSet(base, other, "firstName");
    mergeStringIfBaseNotSet(base, other, "lastName");
    // add other emails to alternative emails
    mergeEmail(base, other);
    mergePhone(base, other, baseDetails);
    mergeAddress(base, other, baseDetails);
}

function mergeEmail(
    base: { email: string | null, alternativeEmails: string[] },
    other: { email: string | null, alternativeEmails: string[] }
) {
    const isEmailMerged = mergeStringIfBaseNotSet(base, other, "email");
    base.alternativeEmails = Formatter.uniqueArray([...base.alternativeEmails, ...other.alternativeEmails]);

    if (!isEmailMerged && !isNullOrEmpty(other.email)) {
        if (!base.alternativeEmails.some((email) => email === other.email!)) {
            base.alternativeEmails.push(other.email!);
        }
    }
}

function mergePhone(
    base: { phone: string | null | undefined },
    other: { phone: string | null | undefined },
    baseDetails: MemberDetails
) {
    const isPhoneMerged = mergeStringIfBaseNotSet(base, other, "phone");
    const otherPhone = other.phone;
    if (!isPhoneMerged && !isNullOrEmpty(otherPhone)) {
        if (
            !baseDetails.unverifiedPhones.some((phone) => phone === otherPhone)
        ) {
            baseDetails.unverifiedPhones.push(otherPhone!);
        }
    }
}

function mergeAddress(
    base: { address: Address | null | undefined },
    other: { address: Address | null | undefined },
    baseDetails: MemberDetails
) {
    const baseAddress = base.address;
    const otherAddress = other.address;

    if (!baseAddress) {
        base.address = otherAddress;
    } else if (otherAddress && baseAddress.id !== otherAddress.id) {
        // add other address to unverified addresses
        if (
            !baseDetails.unverifiedAddresses.some(
                (address) => address.id === otherAddress.id
            )
        ) {
            baseDetails.unverifiedAddresses.push(otherAddress);
        }
    }
}

function mergeStringIfBaseNotSet<T, K extends keyof T>(
    base: T,
    other: T,
    key: K & (T[K] extends string | null | undefined ? K : never)
): boolean {
    const baseValue = base[key] as string | null | undefined;
    if (!isNullOrEmpty(baseValue)) {
        return false;
    }
    const otherValue = other[key] as string | null | undefined;
    if (isNullOrEmpty(otherValue)) {
        return false;
    }

    (base[key] as string | null | undefined) = otherValue;

    return true;
}

function mergeIfBaseNotSet<T, K extends keyof T>(
    base: T,
    other: T,
    key: K &
        (T[K] extends number | Date | boolean | null | undefined ? K : never)
): boolean {
    const baseValue = base[key] as number | Date | boolean | null | undefined;
    if (!(baseValue === null || baseValue === undefined)) return false;
    const otherValue = other[key] as number | Date | boolean | null | undefined;
    if (otherValue === null || otherValue === undefined) return false;
    (base[key] as number | Date | boolean | null | undefined) = otherValue;
    return true;
}

function mergeBooleanStatusIfBaseNotSet<T, K extends keyof T>(
    base: T,
    other: T,
    key: K & (T[K] extends BooleanStatus | null | undefined ? K : never)
): boolean {
    const otherValue = other[key] as BooleanStatus | null | undefined;
    if (otherValue === null || otherValue === undefined) return false;
    const baseValue = base[key] as BooleanStatus | null | undefined;
    if (!(baseValue === null || baseValue === undefined)) {
        if (baseValue.date < otherValue.date) {
            (base[key] as BooleanStatus | null | undefined) = otherValue;
            return true;
        }
        return false;
    }

    (base[key] as BooleanStatus | null | undefined) = otherValue;
    return true;
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
    key: K & (T[K] extends string | null | undefined ? K : never)
) {
    return hasValueAndIsEqual(
        a[key] as string | null | undefined,
        b[key] as string | null | undefined
    );
}

function hasValueAndIsEqual(
    a: string | null | undefined,
    b: string | null | undefined
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
    return value === null || value === undefined || value.trim() === "";
}
