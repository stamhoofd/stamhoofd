import { Migration } from '@simonbackx/simple-database';
import { Member, Organization } from '@stamhoofd/models';
import { Parent, ParentType, PropertyFilter, RecordCategory, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';

enum RnType {
    Member,
    Parent1,
    Parent2,
    ParentUnknown,
    Mother,
    Father,
}

type CategoryPathAndRecord = {
    categoryPath: string[];
    record: RecordSettings;
    category: RecordCategory;
};

type CategoryPathJoinedAndRecord = {
    categoryPath: string;
    record: RecordSettings;
    category: RecordCategory;
};

function getRnRecordsWithCategoryPath(organization: Organization): CategoryPathJoinedAndRecord[] {
    const categories = organization.meta.recordsConfiguration.recordCategories;

    return categories.flatMap(category => getRnRecordsWithCategoryPathHelper(category).map((r) => {
        return {
            ...r,
            categoryPath: r.categoryPath.join(', '),
        };
    }));
}

function getRnRecordsWithCategoryPathHelper(category: RecordCategory): CategoryPathAndRecord[] {
    const results: CategoryPathAndRecord[] = [];

    if (category.childCategories) {
        results.push(...category.childCategories.flatMap((childCategory) => {
            const childResults = getRnRecordsWithCategoryPathHelper(childCategory);
            if (childResults.length === 0) {
                return [];
            }
            return childResults.map((childResult) => {
                return {
                    categoryPath: [category.name.toString(), ...childResult.categoryPath],
                    record: childResult.record,
                    category: childResult.category,
                };
            });
        }));
    }

    results.push(...category.records.filter(r => r.type === RecordType.Text && r.name.toString().toLocaleLowerCase().includes('rijksregisternummer')).map(record => ({ categoryPath: [category.name.toString()], record, category })));
    return results;
}

async function startMigrateRnNumbers() {
    for await (const organization of Organization.select().all()) {
        const nationalRegisterNumberRecords: CategoryPathJoinedAndRecord[] = getRnRecordsWithCategoryPath(organization);

        if (!nationalRegisterNumberRecords.length) {
            continue;
        }

        const isRequired = nationalRegisterNumberRecords.some(r => r.record.required);

        organization.meta.recordsConfiguration.nationalRegisterNumber = new PropertyFilter(null, isRequired ? {} : null);
        await organization.save();

        for await (const member of Member.select()
            .where('organizationId', organization.id)
            .all()) {
            await handleMember(member, nationalRegisterNumberRecords);
        }
    }
}

function getRnType(categoryAndRecord: CategoryPathJoinedAndRecord): RnType {
    const normalizedRecordName = categoryAndRecord.record.name.toString().toLowerCase();
    const normalizedCategoryName = categoryAndRecord.categoryPath.toLowerCase();

    const getParentType = (value: string) => {
        if (['ouder', 'voogd', 'mama', 'papa', 'schuldenaar', 'ontvanger'].some(x => value.includes(x))) {
            if (['1', 'eerste'].some(x => value.includes(x))) {
                return RnType.Parent1;
            }
            if (['2', 'tweede'].some(x => value.includes(x))) {
                return RnType.Parent2;
            }
            if (['mama'].some(x => value.includes(x))) {
                return RnType.Mother;
            }
            if (['papa'].some(x => value.includes(x))) {
                return RnType.Father;
            }
            return RnType.ParentUnknown;
        }
        return null;
    };

    const parentTypeForRecord = getParentType(normalizedRecordName);
    if (parentTypeForRecord) {
        return parentTypeForRecord;
    }

    if (['kind', ' lid', 'zoon', 'dochter'].some(x => normalizedRecordName.includes(x))) {
        return RnType.Member;
    }

    const parentTypeForPath = getParentType(normalizedCategoryName);
    if (parentTypeForPath) {
        return parentTypeForPath;
    }

    return RnType.Member;
}

function getParentByRecordCategory(member: Member, categoryPathAndRecord: CategoryPathJoinedAndRecord): Parent | null {
    if (member.details.parents.length === 1) {
        return member.details.parents[0];
    }

    const possibleNameRecords = categoryPathAndRecord.category.getAllRecords().filter((r) => {
        const normalizedRecordName = r.name.toLowerCase();
        return ['naam '].some(x => normalizedRecordName.includes(x));
    }).map((record) => {
        return record.name.toLowerCase();
    });

    for (const parent of member.details.parents) {
        const firstName = parent.firstName.toLowerCase();
        const lastName = parent.lastName.toLowerCase();

        if (possibleNameRecords.some((x) => {
            if (x === firstName) {
                return true;
            }
            if (x === lastName) {
                return true;
            }
            if (x === firstName + ' ' + lastName) {
                return true;
            }
            if (x === lastName + ' ' + firstName) {
                return true;
            }
            return false;
        })) {
            return parent;
        }
    }

    return null;
}

// todo: remove, temporary for testing
// function cleanMember(member: Member) {
//     member.details.nationalRegisterNumber = null;
//     member.details.parents.forEach(p => p.nationalRegisterNumber = null);
//     member.details.notes = null;
// }

async function handleMember(member: Member, categoryAndRecords: CategoryPathJoinedAndRecord[]) {
    // cleanMember(member);
    // hardcoded exception for member: the member has no parents but has a sibling with parents
    if (member.id === '1e31c769-c6be-4e36-8159-c95e5b522f9f') {
        const sibling = await Member.getByID('c9116cc7-9648-4a5d-8968-ae6a0da086b5');
        if (!sibling) {
            throw new Error('Could not find sibling');
        }
        if (member.details.parents.length === 0) {
            member.details.parents = [...sibling.details.parents];
        }
    }
    const recordAnswers = member.details.recordAnswers;
    const foundRns = new Set<string>();

    for (const categoryAndRecord of categoryAndRecords) {
        const { record } = categoryAndRecord;
        const recordAnswer = recordAnswers.get(record.id);
        if (recordAnswer instanceof RecordTextAnswer) {
            let value = recordAnswer.value;
            if (value && value.length > 6) {
                if (!DataValidator.verifyBelgianNationalNumber(value)) {
                    const warning = `Ongeldig rijksregisternummer: ${value}`;

                    if (!member.details.notes?.includes(warning)) {
                        if (member.details.notes) {
                            member.details.notes = `${member.details.notes}\n${warning}`;
                        }
                        else {
                            member.details.notes = warning;
                        }
                    }
                    continue;
                }

                value = DataValidator.formatBelgianNationalNumber(value);

                const type = getRnType(categoryAndRecord);

                if (type === RnType.Member) {
                    if (member.details.birthDay !== null && !DataValidator.doesMatchBelgianNationalNumber(value, member.details.birthDay)) {
                        // if member is under 18, check if nationRegisterNumber is form person over 18 (=> probably from parent)
                        if (member.details.age! < 18) {
                            const age = getAgeFromNr(value);
                            if (age >= 18) {
                                foundRns.add(value);

                                const warning = 'Het rijksregisternummer van het lid stemt niet overeen met zijn geboortedatum, daarom werd het toegekend aan de ouders.';

                                if (!member.details.notes?.includes(warning)) {
                                    if (member.details.notes) {
                                        member.details.notes = `${member.details.notes}\n${warning}`;
                                    }
                                    else {
                                        member.details.notes = warning;
                                    }
                                }
                                continue;
                            }
                        }

                        if (!member.details.notes?.includes('Het rijksregisternummer stemt niet overeen met de geboortedatum van het lid:')) {
                            if (member.details.notes) {
                                member.details.notes = `${member.details.notes}\nHet rijksregisternummer stemt niet overeen met de geboortedatum van het lid: ${value}`;
                            }
                            else {
                                member.details.notes = `Het rijksregisternummer stemt niet overeen met de geboortedatum van het lid: ${value}`;
                            }
                        }
                        continue;
                    }
                    if (member.details.nationalRegisterNumber === null) {
                        member.details.nationalRegisterNumber = value;
                    }
                }
                else {
                    // #region handle parent
                    const parent = getParentByRecordCategory(member, categoryAndRecord);
                    if (parent) {
                        if (parent.nationalRegisterNumber === null) {
                            parent.nationalRegisterNumber = value;
                        }
                        continue;
                    }
                    if (type === RnType.Parent1) {
                        if (member.details.parents.length > 0) {
                            const parent1 = member.details.parents[0];
                            if (parent1.nationalRegisterNumber === null) {
                                parent1.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                    }
                    else if (type === RnType.Parent2) {
                        if (member.details.parents.length > 1) {
                            const parent2 = member.details.parents[1];
                            if (parent2.nationalRegisterNumber === null) {
                                parent2.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                    }
                    else if (type === RnType.Mother) {
                        const mothers = member.details.parents.filter(p => p.type === ParentType.Mother);
                        if (mothers.length === 1) {
                            const mother = mothers[0];
                            if (mother.nationalRegisterNumber === null) {
                                mother.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                        const stepMothers = member.details.parents.filter(p => p.type === ParentType.Stepmother);
                        if (stepMothers.length === 1) {
                            const stepMother = stepMothers[0];
                            if (stepMother.nationalRegisterNumber === null) {
                                stepMother.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                    }
                    else if (type === RnType.Father) {
                        const fathers = member.details.parents.filter(p => p.type === ParentType.Father);
                        if (fathers.length === 1) {
                            const father = fathers[0];
                            if (father.nationalRegisterNumber === null) {
                                father.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                        const stepFathers = member.details.parents.filter(p => p.type === ParentType.Stepfather);
                        if (stepFathers.length === 1) {
                            const stepFather = stepFathers[0];
                            if (stepFather.nationalRegisterNumber === null) {
                                stepFather.nationalRegisterNumber = value;
                            }
                            continue;
                        }
                    }
                    // #endregion

                    if (member.details.birthDay !== null && DataValidator.doesMatchBelgianNationalNumber(value, member.details.birthDay)) {
                        if (member.details.nationalRegisterNumber === null) {
                            member.details.nationalRegisterNumber = value;
                        }
                        continue;
                    }

                    foundRns.add(value);
                }
            }
        }
    }

    if (foundRns.size) {
        const parentsWithoutRn = member.details.parents.filter(p => p.nationalRegisterNumber === null);

        if (foundRns.size === 1) {
            const parentsNr = [...foundRns][0];
            parentsWithoutRn.forEach(p => p.nationalRegisterNumber = parentsNr);
        }
        else {
            const nrArray = [...foundRns];
            const firstNr = nrArray[0];

            for (const parent of parentsWithoutRn) {
                const nr = nrArray.shift();
                if (nr) {
                    parent.nationalRegisterNumber = nr;
                }
                else if (firstNr) {
                    parent.nationalRegisterNumber = firstNr;
                }
            }

            const warning = 'De rijksregisternummers van de ouders zijn mogelijks omgewisseld.';
            if (!member.details.notes?.includes(warning)) {
                if (member.details.notes) {
                    member.details.notes = `${member.details.notes}\n${warning}`;
                }
                else {
                    member.details.notes = warning;
                }
            }

            if (nrArray.length) {
                if (!member.details.notes?.includes('Niet-toegekende rijksregisternummers')) {
                    if (member.details.notes) {
                        member.details.notes = `${member.details.notes}\nNiet-toegekende rijksregisternummers: ${nrArray.join(', ')}`;
                    }
                    else {
                        member.details.notes = `Niet-toegekende rijksregisternummers: ${nrArray.join(', ')}`;
                    }
                }
            }
        }
    }

    // // todo: remove (temporary)
    // if (member.memberNumber !== null || member.details.memberNumber !== null) {
    //     member.memberNumber = null;
    //     member.details.memberNumber = null;
    // }

    if (hasDuplicateParenRn(member)) {
        const warning = 'Sommige ouders hebben hetzelfde rijksregisternummer, kijk deze na.';
        if (!member.details.notes?.includes(warning)) {
            if (member.details.notes) {
                member.details.notes = `${member.details.notes}\n${warning}`;
            }
            else {
                member.details.notes = warning;
            }
        }
    }

    // member.details.legacyRecordAnswers = [...member.details.recordAnswers.values()];
    await member.save();
}

function hasDuplicateParenRn(member: Member) {
    const rns = member.details.parents.map(p => p.nationalRegisterNumber).filter(p => !!p);
    const uniqueRns = new Set(rns);
    return uniqueRns.size !== rns.length;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startMigrateRnNumbers();
});

function getAgeFromNr(value: string) {
    const birthDate = getBirthDayFromNr(value);
    if (birthDate === null) {
        return -1;
    }
    return getAge(birthDate);
}

function getBirthDayFromNr(value: string): Date | null {
    let year = parseInt(value.substring(0, 2));

    if (isNaN(year)) {
        return null;
    }

    if (year < 30) {
        year = year + 2000;
    }
    else {
        year = year + 1900;
    }

    const monthString = value.substring(3, 5);
    const month = parseInt(monthString);
    if (isNaN(month)) {
        return null;
    }
    const day = parseInt(value.substring(6, 8));
    if (isNaN(day)) {
        return null;
    }
    return new Date(year, month - 1, day);
}

function getAge(birthDate: Date) {
    const now = new Date();
    // For now calculate based on Brussels timezone (we'll need to correct this later)
    const birthDay = Formatter.luxon(birthDate);
    let age = now.getFullYear() - birthDay.year;
    const m = now.getMonth() - (birthDay.month - 1);
    if (m < 0 || (m === 0 && now.getDate() < birthDay.day)) {
        age--;
    }
    return age;
}
