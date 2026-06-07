import { column, Migration } from '@simonbackx/simple-database';
import { AutoEncoder, field } from '@simonbackx/simple-encoding';
import { Organization, Webshop } from '@stamhoofd/models';
import { QueryableModel, SQL } from '@stamhoofd/sql';
import { DataPermissionsSettings, FinancialSupportSettings, Version } from '@stamhoofd/structures';
import { LoggingTools } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { SeedTools } from '../helpers/SeedTools.js';

class OldOrganizationRecordsConfiguration extends AutoEncoder {
    /**
     * If the organizations provides support for families in financial difficulties
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 117 })
    financialSupport: FinancialSupportSettings | null = null;

    /**
     * Ask permissions to collect data
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 117 })
    dataPermission: DataPermissionsSettings | null = null;
}

class OldOrganizationMetaData extends AutoEncoder {
    @field({
        decoder: OldOrganizationRecordsConfiguration,
        version: 53,
        defaultValue: () => OldOrganizationRecordsConfiguration.create({}),
    })
    recordsConfiguration: OldOrganizationRecordsConfiguration = OldOrganizationRecordsConfiguration.create({});
}

// get data like it was in V1
export class OldOrganization extends QueryableModel {
    static table = 'organizations';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * Public meta data
     */
    @column({ type: 'json', decoder: OldOrganizationMetaData })
    meta: OldOrganizationMetaData = OldOrganizationMetaData.create({});
}

export async function startRecordsConfigurationMigration() {
    await SeedTools.loop({
        batchSize: 100,
        query: OldOrganization.select().where(SQL.jsonValue(SQL.column('meta'), '$.version'), '<', Version),
        useTransactionPerBatch: true,
        action: async (oldOrganization: OldOrganization) => {
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
        },
    });

    const webshopProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Webshop.select());

    // migrate recordsConfiguration of webshops
    for await (const webshop of Webshop.select().limit(100).all()) {
        await webshop.save();
        webshopProgressLogger.update();
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
