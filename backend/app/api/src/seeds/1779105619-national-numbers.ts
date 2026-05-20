import { Migration } from '@simonbackx/simple-database';
import { Member, Organization } from '@stamhoofd/models';
import type { Address, RecordAnswer, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { Parent, ParentType, RecordAddressAnswer, RecordTextAnswer } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';

enum RrnTypes {
    Parent1,
    Parent2,
    Father,
    Mother,
    Debtor,
    UnknownParent,
    Unknown,
    Member,
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

    await migrateNationalNumbers(false, true);
});

async function migrateNationalNumbers(dryRun = false, doLog = false) {
    const organizationsWithNumbers = new Set<string>();

    for await (const organization of Organization.select().all()) {
        const hasNumbers = await migrateNumbersOfOrganization(organization, dryRun, doLog);
        if (hasNumbers) {
            organizationsWithNumbers.add(organization.id);

            if (!dryRun) {
                // save
                await organization.save();
            }
        }
    }

    if (doLog) {
        console.log('Migrated national numbers for organizations with id: ' + Array.from(organizationsWithNumbers).map(x => `"${x}"`).join(', '));
    }
    

    if (dryRun) {
        throw new Error('Did not finish migration because of dryRun');
    }
}

function isRrnRecord(record: RecordSettings): boolean {
    const name = record.name.toString().toLowerCase();
    return ['rijksregister', 'rijskregister'].some(x => name.includes(x)) ;
}

function loopAllRecords(organization: Organization, callback: (record: RecordSettings, category: RecordCategory) => void) {
    function recursiveLoopAllRecords(category: RecordCategory, callback: (record: RecordSettings, category: RecordCategory) => void) {
        for (const record of category.records) {
            callback(record, category);
        }

        for (const childCategory of category.childCategories) {
            recursiveLoopAllRecords(childCategory, callback);
        }
    }

    for (const category of organization.meta.recordsConfiguration.recordCategories) {
        recursiveLoopAllRecords(category, callback)
    }
}

async function migrateNumbersOfOrganization(organization: Organization, dryRun: boolean, doLog: boolean): Promise<boolean> {
    const rrnRecords: {type: RrnTypes, record: RecordSettings}[] = [];

    loopAllRecords(organization, (record, category) => {
        const isRrn = isRrnRecord(record);
        if (isRrn) {
            rrnRecords.push({type: getType(record, doLog), record});
            category.records = category.records.filter(r => r.id !== record.id);
        }
    });

    if (rrnRecords.length === 0) {
        // no rrn records
        return false;
    }

    for await (const member of Member.select().where('organizationId', organization.id).all()) {
        const numbersThatCouldNotBeSet = new Map<string, {type: RrnTypes, record: RecordSettings}>();

        for (const {type, record} of rrnRecords) {
            trySetAndRemoveNumber(member, record, type, numbersThatCouldNotBeSet, doLog);
        }

        setRemainingNumbers(member, numbersThatCouldNotBeSet, doLog);

        if (!dryRun) {
            await member.save();
        }
    }

    return true;

}

function getType(record: RecordSettings, doLog: boolean): RrnTypes {
    const name = record.name.toString().toLowerCase();

    if (['papa', 'vader'].some(x => name.includes(x))) {
        return RrnTypes.Father;
    }

    if (['mama', 'moeder'].some(x => name.includes(x))) {
        return RrnTypes.Mother;
    }

    if (['ouder 1', 'parent 1', 'parent1', 'voogd 1'].some(x => name.includes(x))) {
        return RrnTypes.Parent1;
    }

    if (['ouder 2', 'parent 2', 'parent2', 'voogd 2', 'tweede ouder'].some(x => name.includes(x))) {
        return RrnTypes.Parent2;
    }

    if (['kind', 'lid', 'dochter', 'zoon', 'kampdeelnemer', "ksa'er"].some(x => name.includes(x))) {
        return RrnTypes.Member;
    }

    if (['schuldenaar', 'schuldernaar', 'betaler', 'belastingsplichtige'].some(x => name.includes(x))) {
        return RrnTypes.Debtor;
    }

    if (['ouder', 'voogd'].some(x => name.includes(x))) {
        return RrnTypes.UnknownParent;
    }

    if (name === 'rijksregisternummer') {
        return RrnTypes.Unknown;
    }

    if (doLog) {
        console.log('Unknown rrn type: ', record.name.toString());
    }
    
    return RrnTypes.Unknown;
}

function setRemainingNumbers(member: Member, numbersThatCouldNotBeSet: Map<string, {type: RrnTypes, record: RecordSettings}>, doLog: boolean) {

    if (member.details.nationalRegisterNumber === null) {  
        const birthDay = member.details.birthDay;

        if (birthDay !== null) {
            // check if some is from member
            const numberFromMember = [...numbersThatCouldNotBeSet.keys()].find(n => DataValidator.doesMatchBelgianNationalNumber(n, birthDay));
            if (numberFromMember !== undefined) {
                member.details.nationalRegisterNumber = numberFromMember;
                numbersThatCouldNotBeSet.delete(numberFromMember);
            }
        } else {
            const possibility = [...numbersThatCouldNotBeSet.entries()].find(entry => {
            const type = entry[1].type;
                // other types cannot be from member
                // type member would already have been handled before -> will never be the case (but just in case)
                return type ===  RrnTypes.Unknown || type === RrnTypes.Member;
            });

            if (possibility) {
                if (doLog) {
                    console.log('Did set member rrn:', possibility[0], 'type:', possibility[1].type);
                }
                
                const number = possibility[0];
                member.details.nationalRegisterNumber = number;
                numbersThatCouldNotBeSet.delete(number);
                if (numbersThatCouldNotBeSet.size === 0) {
                    return;
                }
            }
        }
    }

    if (numbersThatCouldNotBeSet.size === 0) {
        return;
    }

    const debtorNrs = [...numbersThatCouldNotBeSet.entries()].filter(([,{type}]) => type === RrnTypes.Debtor);
    if (debtorNrs.length > 0) {
        if (debtorNrs.length === 1) {
            const record = debtorNrs[0][1].record;
            const debtor = createParentFromDebtor(member, record);
            if (debtor) {
                const nr = debtorNrs[0][0];
                debtor.nationalRegisterNumber = nr;
                const existing = member.details.parents.find(p => p.firstName.toLowerCase() === debtor.firstName.toLowerCase() && p.lastName.toLowerCase() === debtor.lastName.toLowerCase());
                if (existing) {
                    if (existing.nationalRegisterNumber !== null) {
                        if (doLog) {
                            console.log(`Debtor is existing parent, but parent already has rrn: ${existing.nationalRegisterNumber.toString()} (memberId: ${member.id})`);
                        }
                    } else {
                        if (doLog) {
                            console.log(`Debtor is existing parent, but parent does not have rrn -> set: ${nr} (memberId: ${member.id})`);
                        }
                        existing.nationalRegisterNumber = nr;
                        numbersThatCouldNotBeSet.delete(nr);
                    }

                    if (existing.address === null && debtor.address !== null) {
                        if (doLog) {
                            console.log(`Debtor has address, but parent does not -> set address: ${debtor.address.shortString()} (memberId: ${member.id})`);
                        }
                        
                        existing.address = debtor.address;
                    }
                } else {
                    if (doLog) {
                        console.log(`Added debtor as parent: ${debtor.name} (number: ${debtor.nationalRegisterNumber}, memberId: ${member.id})`);
                    }
                    member.details.parents.push(debtor);
                    numbersThatCouldNotBeSet.delete(nr);
                }
            }

        } else {
            if (doLog) {
                console.log(`Multiple debtors found for member with id: ${member.id}`);
            }   
        }
    }

    const parent1 = member.details.parents[0];

    if (parent1 && parent1.nationalRegisterNumber === null) {
        // first check parent 1
        const parent1Entry = [...numbersThatCouldNotBeSet.entries()].find(entry => entry[1].type === RrnTypes.Parent1);

        if (parent1Entry) {
            const rrn = parent1Entry[0];
            parent1.nationalRegisterNumber = rrn;
            numbersThatCouldNotBeSet.delete(rrn);
        }
    }

    if (numbersThatCouldNotBeSet.size === 0) {
        return;
    }

    const parent2 = member.details.parents.length === 1 ? member.details.parents[0] : member.details.parents[1];

    if (parent2 && parent2.nationalRegisterNumber === null) {
        // next check parent 2
        const parent2Entry = [...numbersThatCouldNotBeSet.entries()].find(entry => entry[1].type === RrnTypes.Parent2);

        if (parent2Entry) {
            const rrn = parent2Entry[0];
            parent2.nationalRegisterNumber = rrn;
            numbersThatCouldNotBeSet.delete(rrn);
        }
    }

    if (numbersThatCouldNotBeSet.size === 0) {
        return;
    }

    // next set in random order
    const remainingNumbers = [...numbersThatCouldNotBeSet.keys()];
    const parentsWithoutNumber = member.details.parents.filter(p => p.nationalRegisterNumber === null);
    
    for (const parent of parentsWithoutNumber) {
        const nextNumber = remainingNumbers.shift();
        if (!nextNumber) {
            // all numbers have been set
            return;
        }

        parent.nationalRegisterNumber = nextNumber;
    }

    // create new parents for remaining numbers
    if (remainingNumbers.length > 0) {
        const newParents: Parent[] = [];

        for (const remainingNumber of remainingNumbers) {
            const rrnType = numbersThatCouldNotBeSet.get(remainingNumber);
            if (rrnType === undefined) {
                continue;
            }
            const type = rrnTypeToParentType(rrnType.type) ?? ParentType.Other;

            const parent = Parent.create({
                type,
                nationalRegisterNumber: remainingNumber
            })

            newParents.push(parent);
        }

        if (newParents.length) {
            member.details.parents.push(...newParents);
        }

        if (doLog) {
            console.log('added parents:', JSON.stringify(newParents), `(memberId: ${member.id})`);
        }
    }
}

function rrnTypeToParentType(type: RrnTypes): ParentType | null {
    if (type === RrnTypes.Member) {
        console.error('rrn type is member');
        return null;
    }

    switch (type) {
        case RrnTypes.Father:
            return ParentType.Father;
        case RrnTypes.Mother:
            return ParentType.Mother;
        case RrnTypes.Parent1:
            return ParentType.Parent1;
        case RrnTypes.Parent2:
            return ParentType.Parent2;
        default:
            return ParentType.Other;
    }
}

function createParentFromDebtor(member: Member, record: RecordSettings): null | Parent {
    const recordName = record.name.toString().toLowerCase();
    const textToSearch = ['schuldenaar', 'schuldernaar', 'betaler', 'belastingsplichtige'].find(x => recordName.includes(x));
    if (!textToSearch) {
        // should not happen
        throw new Error('Could not find text to search: ' + recordName);
    }

    const debtorRecords = [...member.details.recordAnswers.values()].filter(r => {
        const name = r.settings.name.toString().toLowerCase();
        return name.includes(textToSearch);
    });

    if (debtorRecords.length === 0) {
        return null;
    }
    
    let firstNameRecord = getStringValueFromRecord(debtorRecords.find(r => r.settings.name.toString().toLowerCase().includes('voornaam')))?.trim();
    let lastNameRecord = getStringValueFromRecord(debtorRecords.find(r => r.settings.name.toString().toLowerCase().includes('achternaam')))?.trim();

    if (firstNameRecord && lastNameRecord) {
        // sometimes the first and last names are repeated
        if (firstNameRecord.toLowerCase() === lastNameRecord.toLowerCase()) {

            const parts = lastNameRecord.trim().split(' ');
            if (parts.length === 2) {
                firstNameRecord = parts[0];
                lastNameRecord = parts[1];
            } else {
                lastNameRecord = '';
            }
        }
        // sometimes the last name record includes the first name again (e.g. firstName "John" lastName "John Doe")
        else if (lastNameRecord.toLowerCase().startsWith(firstNameRecord.toLowerCase()) || lastNameRecord.toLowerCase().endsWith(firstNameRecord.toLowerCase())) {
            
            if (firstNameRecord.length > 2) {
                lastNameRecord = lastNameRecord.toLowerCase().replace(firstNameRecord.toLowerCase(), '').trim();
            }
        } else if (firstNameRecord.toLowerCase().startsWith(lastNameRecord.toLowerCase()) || firstNameRecord.toLowerCase().endsWith(lastNameRecord.toLowerCase())) {
            
            if (lastNameRecord.length > 2) {
                firstNameRecord = firstNameRecord.toLowerCase().replace(lastNameRecord.toLowerCase(), '').trim();
            }
        }
    }

    const addressRecord = getAddressFromRecord(debtorRecords.find(r => r.settings.name.toString().toLowerCase().includes('adres')));

    return Parent.create({
        type: ParentType.Other,
        firstName: Formatter.capitalizeWords(firstNameRecord ?? ''),
        lastName: Formatter.capitalizeWords(lastNameRecord ?? ''),
        address: addressRecord
    });
}

function getStringValueFromRecord(record: RecordAnswer | undefined): null | string {
    if (!record) {
        return null;
    }

    if (!(record instanceof RecordTextAnswer)) {
        return null;
    }

    return record.value;
}

function getAddressFromRecord(record: RecordAnswer | undefined): null | Address {
    if (!record) {
        return null;
    }

    if (!(record instanceof RecordAddressAnswer)) {
        return null;
    }

    return record.address;
}

function addNumberThatCouldNotBeSet(numbersThatCouldNotBeSet: Map<string, {type: RrnTypes, record: RecordSettings}>, rrn: string, type: RrnTypes, record: RecordSettings) {
    const existing = numbersThatCouldNotBeSet.get(rrn);

    // always set if not set already
    if (existing === undefined) {
        numbersThatCouldNotBeSet.set(rrn, {type, record});
        return;
    }

    // parent 1 has highest priority
    if (existing.type === RrnTypes.Parent1) {
        return;
    }

    if (type === RrnTypes.Parent1) {
        numbersThatCouldNotBeSet.set(rrn, {type, record});
        return;
    }

    // second priority is parent 2
    if (existing.type === RrnTypes.Parent2) {
        return;
    }

    if (type === RrnTypes.Parent2) {
        numbersThatCouldNotBeSet.set(rrn, {type, record});
        return;
    }

    // other types have no priority
    return;
}

function trySetAndRemoveNumber(member: Member, record: RecordSettings, defaultType: RrnTypes, numbersThatCouldNotBeSet: Map<string, {type: RrnTypes, record: RecordSettings}>, doLog: boolean): boolean {
    const rrn = getAndRemoveRrn(record.id, member, doLog);
    if (rrn === null) {
        return true;
    }

    if (defaultType === RrnTypes.Member) {
        member.details.nationalRegisterNumber = rrn;
        return true;
    }

    // always set if from member
    if (member.details.birthDay !== null) {
        const isFromMember = DataValidator.doesMatchBelgianNationalNumber(rrn, member.details.birthDay);
        if (isFromMember) {
            member.details.nationalRegisterNumber = rrn;
            return true;
        }
    }

    const isAlreadySet = member.details.parents.some(p => p.nationalRegisterNumber === rrn);
    if (isAlreadySet) {
        return true;
    }

    const parentsWithoutNumber = member.details.parents.filter(p => p.nationalRegisterNumber === null);
    if (parentsWithoutNumber.length === 0) {
        addNumberThatCouldNotBeSet(numbersThatCouldNotBeSet, rrn, defaultType, record);
        return false;
    }

    // check if from father
    if (defaultType === RrnTypes.Father) {
        const father = parentsWithoutNumber.find(p => p.type === ParentType.Father);
        if (father) {
            father.nationalRegisterNumber = rrn;
            return true;
        }

        const stepFather = parentsWithoutNumber.find(p => p.type === ParentType.Stepfather);
        if (stepFather) {
            stepFather.nationalRegisterNumber = rrn;
            return true;
        }
    }

    // check if from mother
    if (defaultType === RrnTypes.Mother) {
        const mother = parentsWithoutNumber.find(p => p.type === ParentType.Mother);
        if (mother) {
            mother.nationalRegisterNumber = rrn;
            return true;
        }

        const stepMother = parentsWithoutNumber.find(p => p.type === ParentType.Mother);
        if (stepMother) {
            stepMother.nationalRegisterNumber = rrn;
            return true;
        }
    }

    // add to set, check whom this number is from last
    addNumberThatCouldNotBeSet(numbersThatCouldNotBeSet, rrn, defaultType, record);
    return false;
}

function getAndRemoveRrn(recordId: string, member: Member, doLog: boolean): string | null {
    // get answer
    const answer = member.details.recordAnswers.get(recordId);

    // remove answer
    member.details.recordAnswers.delete(recordId);

    if (!answer) {
        return null;
    }

    const text = answer.stringValue;
    if (text.trim() === '') {
        return null;
    }

    if (!DataValidator.verifyBelgianNationalNumber(text)) {
        if (text.length < 6 || /[a-z]/i.test(text)) {
            return null;
        }

        const invalid = ['11111', '123456', '....', '//', '12121'];

        if (invalid.some(x => text.includes(x))) {
            return null;
        }

        return text;
    }

    return text;
}
