import { Migration } from '@node/database';
import { DocumentTemplate } from '@stamhoofd/models';
import {
    RecordCategory,
    RecordSettings,
    RecordType,
    RecordWarning,
    RecordWarningType,
    TranslatedString,
} from '@stamhoofd/structures';
import { FiscalDocumentYearHelper } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * A template keeps the definition it was created with, so the required period of a fiscal certificate only applies to
 * templates made after it was added. Belcotax refuses a fiche without a begin and end date, so the templates that still
 * have to be submitted get the fields too: their certificates become incomplete instead of refused at the download.
 */
export default new Migration(async () => {
    const fiscalDocumentYearHelper = new FiscalDocumentYearHelper();
    let updated = 0;

    await SeedTools.loop({
        batchSize: 100,
        query: DocumentTemplate.select(),
        useTransactionPerBatch: true,
        action: async (template: DocumentTemplate) => {
            const definition = template.privateSettings.templateDefinition;

            if (definition.type !== 'fiscal') {
                return;
            }

            // Only the years that go to Belcotax as JSON lines: marking older certificates incomplete would take
            // them away from the members that already received them
            if (fiscalDocumentYearHelper.isXmlExportSupported(template.year)) {
                return;
            }

            const records = definition.documentFieldCategories.flatMap((c) => c.getAllRecords());
            if (records.some((r) => r.id === 'registration.startDate')) {
                return;
            }

            definition.documentFieldCategories.push(
                RecordCategory.create({
                    id: 'period',
                    name: TranslatedString.create($t('Periode van de opvang')),
                    records: [
                        buildDateRecord(
                            'registration.startDate',
                            $t('Begindatum'),
                            $t(
                                'De begindatum van de opvang ontbreekt. Belcotax weigert een attest zonder periode.',
                            ),
                        ),
                        buildDateRecord(
                            'registration.endDate',
                            $t('Einddatum'),
                            $t(
                                'De einddatum van de opvang ontbreekt. Belcotax weigert een attest zonder periode.',
                            ),
                        ),
                    ],
                }),
            );

            // A locked template is frozen for the organization, but its certificates still have to reach Belcotax
            await template.save({ forceSave: true });
            updated += 1;
        },
    });

    console.log(`Added the period to the fields of ${updated} fiscal document templates`);
});

function buildDateRecord(id: string, name: string, warning: string) {
    return RecordSettings.create({
        id,
        name: TranslatedString.create(name),
        required: true,
        type: RecordType.Date,
        warning: RecordWarning.create({
            id: 'missing.' + id,
            text: TranslatedString.create(warning),
            type: RecordWarningType.Error,
            inverted: true,
        }),
    });
}
