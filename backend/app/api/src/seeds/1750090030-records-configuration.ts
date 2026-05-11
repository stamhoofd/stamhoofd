import { column, Migration } from '@simonbackx/simple-database';
import { AutoEncoder, field } from '@simonbackx/simple-encoding';
import { Organization, Webshop } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
import { DataPermissionsSettings, FinancialSupportSettings } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

class OldOrganizationRecordsConfiguration extends AutoEncoder {
    /**
     * If the organizations provides support for families in financial difficulties
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 117 })
    financialSupport: FinancialSupportSettings | null = null

    /**
     * Ask permissions to collect data
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 117 })
    dataPermission: DataPermissionsSettings | null = null
}

class OldOrganizationMetaData extends AutoEncoder {
        @field({ 
        decoder: OldOrganizationRecordsConfiguration, 
        version: 53,
        defaultValue: () => OldOrganizationRecordsConfiguration.create({})
    })
    recordsConfiguration: OldOrganizationRecordsConfiguration
}

// get data like it was in V1
export class OldOrganization extends QueryableModel {
    static table = 'organizations';

    @column({
    primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    }
    })
    id!: string;

        /**
     * Public meta data
     */
    @column({ type: 'json', decoder: OldOrganizationMetaData })
    meta: OldOrganizationMetaData;
}

export async function startRecordsConfigurationMigration() {

    // migrate recordsConfiguration of organizations
    for await (const oldOrganization of OldOrganization.select().all()) {
        const oldFinancialSupport = oldOrganization.meta.recordsConfiguration.financialSupport;
        const oldDataPermission = oldOrganization.meta.recordsConfiguration.dataPermission;

        if (oldFinancialSupport || oldDataPermission) {
            const newOrganization = await Organization.getByID(oldOrganization.id);

            if (!newOrganization) {
                throw new Error('Organization with id ' + oldOrganization.id + ' not found');
            }

            newOrganization.meta.financialSupport = oldFinancialSupport;
            newOrganization.meta.dataPermission = oldDataPermission;

            await newOrganization.save();
        }
    }

    // migrate recordsConfiguration of webshops
    for await (const webshop of Webshop.select().all()) {
        await webshop.save();
    }
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

    await startRecordsConfigurationMigration();
});
