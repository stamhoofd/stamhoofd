import type {DatabaseInstance} from '@simonbackx/simple-database';

export class DatabaseHelper {
    private _database?: DatabaseInstance;

    constructor(private workerId: string) {}

    async clear() {
        const Database = await this.getDatabase();

        await Database.delete('DELETE FROM `tokens`');
        await Database.delete('DELETE FROM `users`');
        await this.clearRegistrations();
        await this.clearMembers();
        await Database.delete('DELETE FROM `postal_codes`');
        await Database.delete('DELETE FROM `cities`');
        await Database.delete('DELETE FROM `provinces`');
        await Database.delete('DELETE FROM `email_recipients`');
        await Database.delete('DELETE FROM `emails`');
        await Database.delete('DELETE FROM `email_templates`');

        await Database.delete('DELETE FROM `webshop_orders`');
        await Database.delete('DELETE FROM `webshops`');
        await this.clearGroups();
        await Database.delete('DELETE FROM `email_addresses`');
        await Database.update(
            'UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null',
            ['delete'],
        );
        await Database.delete('DELETE FROM `organizations`');
        await Database.delete(
            'DELETE FROM `registration_periods` where customName = ?',
            ['delete'],
        );

        await Database.delete('DELETE FROM `payments`');
        await Database.delete('OPTIMIZE TABLE organizations;'); // fix breaking of indexes due to deletes (mysql bug?)

        // Use random file keys in tests
        // const alg = "ES256";
        // (STAMHOOFD as any).FILE_SIGNING_ALG = alg;

        // const { publicKey, privateKey } = await jose.generateKeyPair(alg);

        // const exportedPublicKey = await jose.exportJWK(publicKey);
        // const exportedPrivateKey = await jose.exportJWK(privateKey);

        // TestUtils.setPermanentEnvironment(
        //     "FILE_SIGNING_PUBLIC_KEY",
        //     exportedPublicKey,
        // );
        // TestUtils.setPermanentEnvironment(
        //     "FILE_SIGNING_PRIVATE_KEY",
        //     exportedPrivateKey,
        // );
    }

    /**
     * Clear the most frequently used tables.
     * @param userId The id of the user to keep
     */
    async reset(userId: string | null) {
        const Database = await this.getDatabase();

        if (userId) {
            await Database.delete('DELETE FROM `users` where id != ?', [
                userId,
            ]);
        }
        else {
            await Database.delete('DELETE FROM `users`');
        }

        await this.clearRegistrations();
        await this.clearMembers();

        await Database.delete('DELETE FROM `email_recipients`');
        await Database.delete('DELETE FROM `emails`');
        await Database.delete('DELETE FROM `email_templates`');

        await Database.delete('DELETE FROM `webshop_orders`');
        await Database.delete('DELETE FROM `webshops`');
        await this.clearGroups();
        await Database.delete('DELETE FROM `email_addresses`');
        await Database.update(
            'UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null',
            ['delete'],
        );
        await Database.delete('DELETE FROM `organizations`');
        await Database.delete(
            'DELETE FROM `registration_periods` where customName = ? and organizationId = null',
            ['delete'],
        );

        await Database.delete('DELETE FROM `payments`');
        await Database.delete('OPTIMIZE TABLE organizations;'); // fix breaking of indexes due to deletes (mysql bug?)
    }

    /**
     * Clear all billing-related tables (packages, payments, balances, mollie state) while keeping
     * organizations and users intact. Used to reset the SAAS billing flow between tests without
     * destroying the worker organization (whose auth token is reused across tests).
     */
    async clearBilling() {
        const Database = await this.getDatabase();
        await Database.delete('DELETE FROM `stamhoofd_packages`');
        await Database.delete('DELETE FROM `balance_item_payments`');
        await Database.delete('DELETE FROM `balance_items`');
        await Database.delete('DELETE FROM `mollie_payments`');
        await Database.delete('DELETE FROM `payments`');
        await Database.delete('DELETE FROM `mollie_tokens`');
    }

    async clearRegistrations() {
        const Database = await this.getDatabase();
        await Database.delete('DELETE FROM `registrations`');
    }

    async clearMembers() {
        const Database = await this.getDatabase();
        await Database.delete('DELETE FROM `_members_users`');
        await Database.delete('DELETE FROM `members`');
    }

    async clearGroups() {
        const Database = await this.getDatabase();
        await Database.delete('DELETE FROM `groups`');
    }

    private async getDatabase(): Promise<DatabaseInstance> {
        if (this._database) {
            return this._database;
        }

        process.env.DB_DATABASE = `stamhoofd-playwright-${this.workerId}`;
        const { Database } = await import('@simonbackx/simple-database');
        return Database;
    }
}
