import { type DatabaseInstance } from "@simonbackx/simple-database";

export class DatabaseHelper {
    private _database?: DatabaseInstance;

    constructor(private workerId: string) {}

    async clear() {
        const Database = await this.getDatabase();

        await Database.delete("DELETE FROM `tokens`");
        await Database.delete("DELETE FROM `users`");
        await Database.delete("DELETE FROM `registrations`");
        await Database.delete("DELETE FROM `members`");
        await Database.delete("DELETE FROM `postal_codes`");
        await Database.delete("DELETE FROM `cities`");
        await Database.delete("DELETE FROM `provinces`");
        await Database.delete("DELETE FROM `email_recipients`");
        await Database.delete("DELETE FROM `emails`");
        await Database.delete("DELETE FROM `email_templates`");

        await Database.delete("DELETE FROM `webshop_orders`");
        await Database.delete("DELETE FROM `webshops`");
        await Database.delete("DELETE FROM `groups`");
        await Database.delete("DELETE FROM `email_addresses`");
        await Database.update(
            "UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null",
            ["delete"],
        );
        await Database.delete("DELETE FROM `organizations`");
        await Database.delete(
            "DELETE FROM `registration_periods` where customName = ?",
            ["delete"],
        );

        await Database.delete("DELETE FROM `payments`");
        await Database.delete("OPTIMIZE TABLE organizations;"); // fix breaking of indexes due to deletes (mysql bug?)

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

    private async getDatabase(): Promise<DatabaseInstance> {
        if (this._database) {
            return this._database;
        }

        process.env.DB_DATABASE = `stamhoofd-playwright-${this.workerId}`;
        const { Database } = await import("@simonbackx/simple-database");
        return Database;
    }
}
