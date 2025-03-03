import { Migration } from '@simonbackx/simple-database';
import { AuditLog } from '@stamhoofd/models';
import { scalarToSQLExpression, SQL, SQLWhereLike } from '@stamhoofd/sql';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'keeo') {
        console.log('skipped for platform (only run for keeo): ' + STAMHOOFD.platformName);
        return;
    }

    console.log('Start fixing audit log descriptions.');

    const batchSize = 100;
    let count = 0;

    for await (const log of AuditLog.select()
        .where(new SQLWhereLike(
            SQL.column('audit_logs', 'description'),
            scalarToSQLExpression(`%werd verplaatst van % naar %, door%`),
        )).limit(batchSize).all()) {
        if (log.meta.get('fixed') === 1) {
            continue;
        }
        log.description = fixDescription(log.description);
        log.meta.set('fixed', 1);
        await log.save();
        count += 1;
    }

    console.log('Finished saving ' + count + ' audit logs.');
});

function fixDescription(description: string): string {
    const regex = /werd verplaatst van (.+) naar (.*), door/;
    const result = description.match(regex);
    if (!result) {
        throw new Error(`Could not fix audit log description, no regex match found: ${description}`);
    }

    const to = result[1];
    const from = result[2];

    const fixed = description.replace(regex, `werd verplaatst van ${from} naar ${to}, door`);
    return fixed;
}
