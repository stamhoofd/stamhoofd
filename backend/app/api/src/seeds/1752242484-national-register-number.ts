import { Migration } from '@simonbackx/simple-database';
import { Member, Organization } from '@stamhoofd/models';
import { Parent, ParentType, PropertyFilter, RecordCategory, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';

// type CategoryAndRecord = {
//     category: RecordCategory;
//     record: RecordSettings;
// };

let okCount = 0;
let errorCount = 0;

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
            await handleMember(member, nationalRegisterNumberRecords, organization);
        }
    }
}

function getRnType(categoryAndRecord: CategoryPathJoinedAndRecord): RnType {
    const normalizedRecordName = categoryAndRecord.record.name.toString().toLowerCase();
    const normalizedCategoryName = categoryAndRecord.categoryPath.toLowerCase();

    if (['ouder', 'voogd', 'mama', 'papa', 'schuldenaar', 'ontvanger'].some(x => normalizedRecordName.includes(x) || normalizedCategoryName.includes(x))) {
        if (['1', 'eerste'].some(x => normalizedRecordName.includes(x) || normalizedCategoryName.includes(x))) {
            return RnType.Parent1;
        }
        if (['2', 'tweede'].some(x => normalizedRecordName.includes(x) || normalizedCategoryName.includes(x))) {
            return RnType.Parent2;
        }
        if (['mama'].some(x => normalizedRecordName.includes(x) || normalizedCategoryName.includes(x))) {
            return RnType.Mother;
        }
        if (['papa'].some(x => normalizedRecordName.includes(x) || normalizedCategoryName.includes(x))) {
            return RnType.Father;
        }
        return RnType.ParentUnknown;
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
function cleanMember(member: Member) {
    member.details.nationalRegisterNumber = null;
    member.details.parents.forEach(p => p.nationalRegisterNumber = null);
}

async function handleMember(member: Member, categoryAndRecords: CategoryPathJoinedAndRecord[], organization: Organization) {
    cleanMember(member);
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
    let parentsRn: string | null = null;

    for (const categoryAndRecord of categoryAndRecords) {
        const { record } = categoryAndRecord;
        const recordAnswer = recordAnswers.get(record.id);
        if (recordAnswer instanceof RecordTextAnswer) {
            let value = recordAnswer.value;
            if (value && value.length > 6) {
                if (!DataValidator.verifyBelgianNationalNumber(value)) {
                    console.error(`Invalid national register number: ${value}`);
                    continue;
                }

                value = DataValidator.formatBelgianNationalNumber(value);

                const type = getRnType(categoryAndRecord);

                if (type === RnType.Member) {
                    if (member.details.birthDay !== null && !DataValidator.doesMatchBelgianNationalNumber(value, member.details.birthDay)) {
                        errorCount++;
                        // todo: add to notes?
                        // console.error(`Invalid national register number: ${value} does not match birth day: ${Formatter.date(member.details.birthDay)}`);
                        // console.error(categoryAndRecord.categoryPath, ' (record name: ', record.name.toString(), ')');
                        continue;
                    }
                    okCount++;
                    if (member.details.nationalRegisterNumber === null) {
                        member.details.nationalRegisterNumber = value;
                    }
                }
                else {
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

                    if (parentsRn === value) {
                        continue;
                    }

                    // hardcoded exceptions for members (both parents have type mother, but the second parent should be a father)
                    if (['09b15c9d-387b-42df-9d41-e26e23920021', '1a3a7ac5-1c6d-4959-8a4e-7fc874fe1920'].includes(member.id)) {
                        if (type === RnType.Mother) {
                            member.details.parents[0].nationalRegisterNumber = value;
                        }
                        else if (type === RnType.Father) {
                            member.details.parents[1].nationalRegisterNumber = value;
                        }
                        continue;
                    }
                    else if (parentsRn !== null) {
                        // known exception, do not log (has two mothers -> guess which rn is for whom)
                        if (member.id !== '8246e6c1-1039-4cc5-be63-d0632d3a4a04') {
                            console.error(`Parents of member ${member.id} already have a national register number: ${parentsRn} (value: ${value})`);
                        }

                        const parentWithoutRN = member.details.parents.find(p => p.nationalRegisterNumber === null);
                        if (parentWithoutRN) {
                            parentWithoutRN.nationalRegisterNumber = value;
                        }
                        return;
                    }
                    parentsRn = value;
                }
            }
        }
        // else {
        //     if (recordAnswer instanceof RecordAnswer) {
        //         console.error(record.name.toString());
        //         console.error('record answer is not of type text: ', recordAnswer.settings.type);
        //     }
        //     // else {
        //     //     if (doLog) {
        //     //         console.error(record.name.toString());
        //     //         console.error('record answer is not of type text: ', typeof recordAnswer);
        //     //     }
        //     // }
        // }
    }

    if (parentsRn !== null) {
        const parentsWithoutRn = member.details.parents.filter(p => p.nationalRegisterNumber === null);
        for (const parent of parentsWithoutRn) {
            parent.nationalRegisterNumber = parentsRn;
        }
    }

    // todo: change constraints

    // // todo: remove (temporary)
    // if (member.memberNumber !== null || member.details.memberNumber !== null) {
    //     member.memberNumber = null;
    //     member.details.memberNumber = null;
    // }

    member.details.legacyRecordAnswers = [...member.details.recordAnswers.values()];
    await member.save();
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
    console.log('ok count: ', okCount);
    console.log('error count: ', errorCount);
});
