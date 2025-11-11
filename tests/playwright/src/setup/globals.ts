import type { FullConfig } from "@playwright/test";
// import * as jose from "jose";
// import { TestUtils } from "../../../../shared/test-utils/dist";
import { CaddyHelper } from "./helpers/CaddyHelper";

async function globalSetup(config: FullConfig) {
    console.log("Start global setup");
    if (process.env.NODE_ENV !== "test") {
        throw new Error(
            "Global setup should not run if not in test environment",
        );
    }

    const caddyHelper = new CaddyHelper();
    // make sure all playwright routes are deleted
    await caddyHelper.deleteAllPlaywrightRoutes();
    console.log("Finished global setup");
}

export async function globalTeardown() {
    console.log("Start global teardown");
    const caddyHelper = new CaddyHelper();
    await caddyHelper.deleteAllPlaywrightRoutes();
    console.log("Finished global teardown");
}

// async function resetDatabase() {
//     console.log("Reset database");

//     const { Database } = await import("@simonbackx/simple-database");

//     await Database.delete("DELETE FROM `tokens`");
//     await Database.delete("DELETE FROM `users`");
//     await Database.delete("DELETE FROM `registrations`");
//     await Database.delete("DELETE FROM `members`");
//     await Database.delete("DELETE FROM `postal_codes`");
//     await Database.delete("DELETE FROM `cities`");
//     await Database.delete("DELETE FROM `provinces`");
//     await Database.delete("DELETE FROM `email_recipients`");
//     await Database.delete("DELETE FROM `emails`");
//     await Database.delete("DELETE FROM `email_templates`");

//     await Database.delete("DELETE FROM `webshop_orders`");
//     await Database.delete("DELETE FROM `webshops`");
//     await Database.delete("DELETE FROM `groups`");
//     await Database.delete("DELETE FROM `email_addresses`");
//     await Database.update(
//         "UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null",
//         ["delete"],
//     );
//     await Database.delete("DELETE FROM `organizations`");
//     await Database.delete(
//         "DELETE FROM `registration_periods` where customName = ?",
//         ["delete"],
//     );

//     await Database.delete("DELETE FROM `payments`");
//     await Database.delete("OPTIMIZE TABLE organizations;"); // fix breaking of indexes due to deletes (mysql bug?)

//     // Use random file keys in tests
//     const alg = "ES256";
//     (STAMHOOFD as any).FILE_SIGNING_ALG = alg;

//     const { publicKey, privateKey } = await jose.generateKeyPair(alg);

//     const exportedPublicKey = await jose.exportJWK(publicKey);
//     const exportedPrivateKey = await jose.exportJWK(privateKey);

//     TestUtils.setPermanentEnvironment(
//         "FILE_SIGNING_PUBLIC_KEY",
//         exportedPublicKey,
//     );
//     TestUtils.setPermanentEnvironment(
//         "FILE_SIGNING_PRIVATE_KEY",
//         exportedPrivateKey,
//     );
// }

export default globalSetup;
