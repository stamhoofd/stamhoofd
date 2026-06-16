import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import type { OrganizationRecordsConfiguration, RecordCategory, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { PropertyFilter } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

type GroupStamhoofdFilter = { group: { id: { $eq: string } } };
// type RegistrationsFilter = { registrations: { $elemMatch:}}

// class RegistrationsFilterWrapper {
//     private isInverted: boolean;
//     private readonly mode: 'and' | 'or';
//     private readonly groupdIds: Set<string>;

//     constructor(filter: StamhoofdFilter) {

//     }
// }

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startMigration();
    // throw new Error('test');
});

function logTextToFile(text: string) {
    // const text: string = 'Hello, this is the text I want to save!';
    // const filePath: string = 'output-2.txt';

    // try {
    //     fs.appendFileSync(filePath, text);
    //     // console.log(`Text successfully written to ${filePath}`);
    // } catch (err) {
    //     console.error('Error writing file:', err);
    // }
}

async function startMigration(skip = true) {
    if (skip) {
        return;
    }
    // todo: loop all record configurations where a groupId is configured
    // should only be the case for organization record configurations

    // const organizationsWithGroupFilters = new Set<string>();
    const groupFilters: StamhoofdFilter[] = [];

    await SeedTools.loop({
        batchSize: 1,
        query: Organization.select(),
        action: async (organization: Organization) => {
            for (const filter of getAllStamhoofdFilters(organization)) {
                if (hasGroupFilter(filter)) {
                    groupFilters.push(filter);
                    // organizationsWithGroupFilters.add(organization.id);
                    if (!filter?.['registrations'] || Object.keys(filter).length > 1) {
                        logTextToFile(JSON.stringify(filter) + ', ');
                    }

                    // console.log('has group filter: ', JSON.stringify(filter));
                    // await sleep(3000);
                }
            }
        },
    });

    // console.error('organizationsWithGroupFilters: ', JSON.stringify([...organizationsWithGroupFilters.values()]));
    // console.error(JSON.stringify(groupFilters));
}

function getAllStamhoofdFilters(organization: Organization): StamhoofdFilter[] {
    return getAllPropertyFilters(organization)
        .flatMap(propertyFilter => [propertyFilter.enabledWhen, propertyFilter.requiredWhen].filter(filter => filter !== null) as StamhoofdFilter[]);
}

function hasGroupFilter(filter: StamhoofdFilter | StamhoofdCompareValue): boolean {
    if (filter === null) {
        return false;
    }

    if (typeof filter !== 'object') {
        return false;
    }

    if (filter instanceof Date) {
        return false;
    }

    if (Array.isArray(filter)) {
        return filter.some(f => hasGroupFilter(f));
    }

    // iterate properties
    for (const [key, value] of Object.entries(filter as object) as [string, StamhoofdFilter | StamhoofdCompareValue][]) {
        if (key === 'group') {
            const possibleMatch: { id?: { $eq?: string | any } | any } | any = value;
            if (typeof possibleMatch?.id?.$eq === 'string') {
                return true;
            }
        }

        if (hasGroupFilter(value)) {
            return true;
        }
    }

    return false;
}

function getAllPropertyFilters(organization: Organization): PropertyFilter[] {
    const recordsConfig: OrganizationRecordsConfiguration = organization.meta.recordsConfiguration;

    const propertyFilters: PropertyFilter[] = [];

    for (const [key, value] of Object.entries(recordsConfig)) {
        if (value instanceof PropertyFilter) {
            propertyFilters.push(value);
        }
    }

    // todo: also add record categories
    const recordCategoryFilters: PropertyFilter[] = recordsConfig.recordCategories.flatMap(category => getAllRecordCategories(category)).map(c => c.filter).filter(f => f !== null);

    return [...propertyFilters, ...recordCategoryFilters];
}

function getAllRecordCategories(recordCategory: RecordCategory): RecordCategory[] {
    const childCategories = recordCategory.childCategories.flatMap(c => getAllRecordCategories(c));
    return [recordCategory, ...childCategories];
}
