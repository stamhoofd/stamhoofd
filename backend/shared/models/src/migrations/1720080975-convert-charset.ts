import { Database, Migration } from '@simonbackx/simple-database';
import { LoggingTools } from '@stamhoofd/utility';

const CONCURRENCY = 4;

export default new Migration(async () => {
    process.stdout.write('\n');

    if (STAMHOOFD.userMode === 'platform' && (STAMHOOFD.environment === 'production' || STAMHOOFD.environment === 'staging')) {
        console.log('Skipped convert charset for userMode platform in production.');
        return;
    }

    const tables = ['webshop_orders', 'webshop_tickets', 'registrations', 'balance_items', 'payments', 'users', 'tokens', '_members_users', 'balance_item_payments', 'buckaroo_payments', 'cities', 'document_templates', 'documents', 'email_templates', 'email_verification_codes', 'groups', 'images', 'members', 'migrations', 'mollie_payments', 'mollie_tokens', 'organization_registration_periods', 'organizations', 'password_tokens', 'payconiq_payments', 'platform', 'postal_codes', 'provinces', 'register_codes', 'registration_periods', 'stamhoofd_credits', 'stamhoofd_invoices', 'stamhoofd_packages', 'stamhoofd_pending_invoices', 'streets', 'stripe_accounts', 'stripe_checkout_sessions', 'stripe_payment_intents', 'used_register_codes', 'webshop_discount_codes', 'webshops'];

    const progressLogger = LoggingTools.createProgressLogger(tables.length, { tag: 'convert tables charset' });

    const queue = [...tables];
    await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
            for (;;) {
                const table = queue.shift();
                if (table === undefined) return;
                await convertTable(table);
                progressLogger.update();
            }
        }),
    );

    console.log('Start set database charset.');
    await Database.statement('ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');
});

async function convertTable(name: string): Promise<void> {
    await Database.beginTransaction(async () => {
        await Database.statement('set foreign_key_checks=0;');

        console.log('Start converting charset of table: ' + name);
        await Database.statement('ALTER TABLE `' + name + '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');

        await Database.statement('set foreign_key_checks=1;');
    });
}
