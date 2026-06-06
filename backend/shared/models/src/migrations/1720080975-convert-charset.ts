import { Database, Migration } from '@simonbackx/simple-database';
import { LoggingTools } from '@stamhoofd/utility';

export default new Migration(async () => {
    process.stdout.write('\n');

    if (STAMHOOFD.userMode === 'platform') {
        console.log('Skipped convert charset for userMode platform.');
        return;
    }

    await Database.statement('set foreign_key_checks=0;');

    const tables = ['_members_users', 'balance_item_payments', 'balance_items', 'buckaroo_payments', 'cities', 'document_templates', 'documents', 'email_templates', 'email_verification_codes', 'groups', 'images', 'members', 'migrations', 'mollie_payments', 'mollie_tokens', 'organization_registration_periods', 'organizations', 'password_tokens', 'payconiq_payments', 'payments', 'platform', 'postal_codes', 'provinces', 'register_codes', 'registration_periods', 'registrations', 'stamhoofd_credits', 'stamhoofd_invoices', 'stamhoofd_packages', 'stamhoofd_pending_invoices', 'streets', 'stripe_accounts', 'stripe_checkout_sessions', 'stripe_payment_intents', 'tokens', 'used_register_codes', 'users', 'webshop_discount_codes', 'webshop_orders', 'webshop_tickets', 'webshops'];

    const progressLogger = LoggingTools.createProgressLogger(tables.length, { tag: 'convert tables charset' });

    for (const table of tables) {
        await convertTable(table);
        progressLogger.update();
    }

    console.log('Start set database charset.');
    await Database.statement('ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');
    await Database.statement('set foreign_key_checks=1;');
});

async function convertTable(name: string): Promise<void> {
    console.log('Start set charset of table: ' + name);
    await Database.statement('ALTER TABLE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');
    console.log('Start converting charset of table: ' + name);
    await Database.statement('ALTER TABLE `' + name + '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');
}
