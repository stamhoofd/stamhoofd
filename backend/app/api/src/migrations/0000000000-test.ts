import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import type { Address, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import fs from 'fs';
import { SeedTools } from '../helpers/SeedTools.js';
import { Formatter } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = true;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

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

type RrnHolderData = {
    type?: RrnTypes;
    firstName?: string;
    lastName?: string;
    address?: Address;
    phone?: string;
    email?: string;

};

// based on manually examining the data
// const relevantChildCategoryNames = new Set<string>(['schuldenaar', 'Rijksregisternummer OUDER', 'Gegevens ouders'].map(x => x.toLowerCase()));

async function start(dryRun: boolean) {
    const organizationResults: { organization: { id: string; name: string }; count: number; results: any[] }[] = [];

    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            // if (group.settings.period !== null) {
            //     return;
            // }

            const results: RecordCategory[] = [];
            const categoryWrappers: RecordCategoryWrapper[] = [];

            loopAllRecordCatgoriesWithRrn(organization, (category) => {
                categoryWrappers.push(new RecordCategoryWrapper(category));
                const categoryWrapper = new RecordCategoryWrapper(category);
                results.push(category);
            });

            if(categoryWrappers.length === 0) {
                return;
            }

            if (results.length > 0) {
                organizationResults.push({
                    organization: {
                        id: organization.id,
                        name: organization.name,
                    },
                    count: results.length,
                    results: results.map(c => summarizeCategory(c)),
                });
            }
        },

    });

    logTextToFile(JSON.stringify(organizationResults.sort((a, b) => b.count - a.count)));
}

function summarizeCategory(category: RecordCategory) {
    const name = category.name.toString();
    const records = category.records.map((r) => {
        return r.name.toString();
    });

    const relevantChildCategoryNames = new Set<string>(['schuldenaar', 'Rijksregisternummer OUDER', 'Gegevens ouders'].map(x => x.toLowerCase()));

    const childCategories = category.childCategories.filter(c => relevantChildCategoryNames.has(c.name.toString().toLowerCase())).map(c => summarizeCategory(c));

    if (childCategories.length > 0) {
        return {
            name,
            records,
            childCategories,
        };
    }

    return {
        name,
        records,
    };
}

function logTextToFile(text: string) {
    const path = 'rrn-log-wip.txt';
    try {
        fs.appendFileSync(path, text);
    } catch (err) {
        console.error('Error writing file:', err);
    }
}

class RecordCategoryWrapper {
    readonly recordWrappers: RecordWrapper[] = [];

    get id() {
        return this.category.id;
    }

    get name() {
        return this.category.name.toString();
    }

    readonly type: RrnTypes;

    constructor(readonly category: RecordCategory) {
        this.type = getTypeFromName(this.name);
    }
}

class RecordWrapper{
    get id() {
        return this.record.id;
    }

    get name() {
        return this.record.name.toString();
    }

    readonly type: RrnTypes;

    constructor(readonly record: RecordSettings) {
        this.type = getTypeFromName(this.name);
    }
}

function getTypeFromName(rawName: string): RrnTypes {
        const name = Formatter.slug(rawName).replaceAll('-', '');
    
        if (['papa', 'vader'].some(x => name.includes(x))) {
            return RrnTypes.Father;
        }
    
        if (['mama', 'moeder'].some(x => name.includes(x))) {
            return RrnTypes.Mother;
        }
    
        if (['ouder1', 'parent1', 'voogd1'].some(x => name.includes(x))) {
            return RrnTypes.Parent1;
        }
    
        if (['ouder2', 'parent2', 'parent2', 'voogd2', 'tweedeouder'].some(x => name.includes(x))) {
            return RrnTypes.Parent2;
        }
    
        if (['kind', 'lid', 'dochter', 'zoon', 'kampdeelnemer', 'ksaer'].some(x => name.includes(x))) {
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
    
        return RrnTypes.Unknown;
    }

// function handleRecordCategorWithRrn(organization: Organization, category: RecordCategory) {

// }

function getRrnHoldersForOrganization

function loopAllRecordCatgoriesWithRrn(organization: Organization, callback: (category: RecordCategory) => void) {
    function isRrnRecord(record: RecordSettings): boolean {
        const name = record.name.toString().toLowerCase();
        return ['rijksregister', 'rijskregister'].some(x => name.includes(x));
    }

    function flattenCategory(category: RecordCategory): RecordCategory[] {
    // based on manually examining the data
        const relevantChildCategoryNames = new Set<string>(['schuldenaar', 'Rijksregisternummer OUDER', 'Gegevens ouders'].map(x => x.toLowerCase()));
        const childCategories = category.childCategories.filter(c => relevantChildCategoryNames.has(c.name.toString().toLowerCase()));
        return [category, ...childCategories];
    }

    function recursiveLoopAllRecords(category: RecordCategory, callback: (category: RecordCategory) => void) {
        for (const record of category.records) {
            if (isRrnRecord(record)) {
                flattenCategory(category).forEach(c => callback(c));
                return;
            }
        }

        for (const childCategory of category.childCategories) {
            recursiveLoopAllRecords(childCategory, callback);
        }
    }

    for (const category of organization.meta.recordsConfiguration.recordCategories) {
        recursiveLoopAllRecords(category, callback);
    }
}
