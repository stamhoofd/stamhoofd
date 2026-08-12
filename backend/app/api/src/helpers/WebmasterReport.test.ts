import { EmailMocker } from '@stamhoofd/email';
import { QueueHandler } from '@stamhoofd/queues';

import { WebmasterReport } from './WebmasterReport.js';

describe('WebmasterReport', () => {
    // Emails of other tests can still be in the queue when this one runs: match on the subject
    const getEmails = async (subjectPrefix = 'Synchroniseren uitbetalingen') => {
        return (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.subject.startsWith(subjectPrefix));
    };

    test('problems reported inside a group are sent as one email', async () => {
        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            WebmasterReport.report('Uitbetaling po_1 mislukt', new Error('Boom'));
            WebmasterReport.report('Uitbetaling po_2 mislukt', 'Geen betaling gevonden');
        });

        const emails = await getEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Synchroniseren uitbetalingen: 2 problemen');
        expect(emails[0].html).toContain('Uitbetaling po_1 mislukt');
        expect(emails[0].html).toContain('Error: Boom');
        expect(emails[0].html).toContain('Uitbetaling po_2 mislukt');
        expect(emails[0].html).toContain('Geen betaling gevonden');
    });

    test('a group without problems sends nothing', async () => {
        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            // Nothing to report
        });

        expect(await getEmails()).toHaveLength(0);
    });

    test('problems are still reported when the group throws', async () => {
        await expect(WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            WebmasterReport.report('Uitbetaling po_1 mislukt');
            throw new Error('Boom');
        })).rejects.toThrow('Boom');

        const emails = await getEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Synchroniseren uitbetalingen: 1 probleem');
    });

    test('only the first problems are listed, the rest is counted', async () => {
        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            for (let index = 0; index < 100; index++) {
                WebmasterReport.report('Uitbetaling po_' + index + ' mislukt');
            }
        });

        const emails = await getEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Synchroniseren uitbetalingen: 100 problemen');
        expect(emails[0].html).toContain('Uitbetaling po_19 mislukt');
        expect(emails[0].html).not.toContain('Uitbetaling po_20 mislukt');
        expect(emails[0].html).toContain('En nog 80 andere problemen');
    });

    test('problems reported in queued work land in the surrounding group', async () => {
        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            await QueueHandler.schedule('webmaster-report-test', async () => {
                WebmasterReport.report('Uitbetaling po_1 mislukt');
            });
        });

        const emails = await getEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].subject).toBe('Synchroniseren uitbetalingen: 1 probleem');
    });

    test('titles and details are escaped', async () => {
        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            WebmasterReport.report('Uitbetaling van <b>Chiro & Co</b> mislukt', new Error('Regel 1\nRegel 2'));
        });

        const [email] = await getEmails();
        expect(email.html).toContain('Uitbetaling van &lt;b&gt;Chiro &amp; Co&lt;/b&gt; mislukt');
        expect(email.html).toContain('Regel 1<br>Regel 2');
    });

    test('a problem reported outside a group is sent on its own', async () => {
        WebmasterReport.report('Uitbetaling po_1 mislukt', new Error('Boom'));

        const emails = await getEmails('Uitbetaling po_1 mislukt');
        expect(emails).toHaveLength(1);
        expect(emails[0].html).toContain('Error: Boom');
    });

    test('groups only collect the problems reported inside them', async () => {
        await Promise.all([
            WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
                await Promise.resolve();
                WebmasterReport.report('Uitbetaling po_1 mislukt');
            }),
            WebmasterReport.group('Aanrekenen applicatiekosten', async () => {
                WebmasterReport.report('Maand 2026-01 overgeslagen');
            }),
        ]);

        const [sync] = await getEmails();
        const [invoicing] = await getEmails('Aanrekenen applicatiekosten');
        expect(sync.subject).toBe('Synchroniseren uitbetalingen: 1 probleem');
        expect(sync.html).toContain('Uitbetaling po_1 mislukt');
        expect(invoicing.subject).toBe('Aanrekenen applicatiekosten: 1 probleem');
        expect(invoicing.html).toContain('Maand 2026-01 overgeslagen');
    });
});
