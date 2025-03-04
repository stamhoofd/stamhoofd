import { Migration } from '@simonbackx/simple-database';
import { AuditLog } from '@stamhoofd/models';
import { scalarToSQLExpression, SQL, SQLWhereLike } from '@stamhoofd/sql';

const replacements: [from: string, to: string][] = [
    ['u00eb', 'ë'],
    ['u00E9', 'é'],
    ['U00EF', 'ï'],
    ['U00E6', 'æ'],
    ['U00F6', 'ö'],
    ['U00E0', 'à'],
    ['U00E1', 'á'],
    ['U00E7', 'ç'],
    ['U00E4', 'ä'],
    ['U00E5', 'å'],
    ['U00E8', 'è'],
    ['U00F3', 'ó'],
    ['U00ED', 'í'],
    ['U00C4', 'Ä'],
    ['U00C1', 'Á'],
    ['U00FC', 'ü'],
    ['U00F4', 'ö'],
    ['U00D6', 'Ö'],
    ['U00C9', 'É'],
    ['U00F2', 'ò'],
    ['U00E2', 'â'],
    ['U00F2', 'ò'],
    ['U00F2', 'ò'],
    ['U00E2', 'â'],
    ['U00EC', 'ì'],
    ['U00C5', 'Å'],
    ['U00EE', 'î'],
    ['U00A9', '©'],
    ['U00C3', 'Ã'],
    ['U00C7', 'Ç'],
    ['U00F9', 'ù'],
    ['U00EA', 'ê'],
    ['U00FF', 'ÿ'],
    ['U00CA', 'Ê'],
    ['U00CD', 'Í'],
    ['U00A8', '¨'],
    ['U00AF', '¯'],
    ['U00AB', '«'],
    ['U00CE', 'Î'],
];

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'keeo') {
        console.log('skipped for platform (only run for keeo): ' + STAMHOOFD.platformName);
        return;
    }

    console.log('Start fixing audit log uft16 descriptions.');

    const batchSize = 100;
    let count = 0;

    for await (const log of AuditLog.select()
        .where(new SQLWhereLike(
            SQL.column('audit_logs', 'description'),
            scalarToSQLExpression(`%u00%`),
        ))
        .limit(batchSize).all()) {
        if (log.meta.get('fixed-uft16') === 1) {
            continue;
        }
        log.description = fixDescription(log.description);
        log.meta.set('fixed-uft16', 1);
        await log.save();
        count += 1;
    }

    console.log('Finished saving ' + count + ' audit logs uft16.');
});

function fixDescription(description: string): string {
    let result = description;
    replacements.forEach(([from, to]) => {
        result = result.replace(new RegExp(from.toLowerCase(), 'g'), to);
    });

    return result;
}
