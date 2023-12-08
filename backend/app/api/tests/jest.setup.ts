require('@stamhoofd/backend-env').load({path: __dirname+'/../../.env.test.json'})

import { Column,Database } from "@simonbackx/simple-database";
import { Request } from '@simonbackx/simple-endpoints';
import { I18n } from "@stamhoofd/backend-i18n";
import { Email } from "@stamhoofd/email";
import { Version } from '@stamhoofd/structures';
import { sleep } from "@stamhoofd/utility";

// Set version of saved structures
Column.setJSONVersion(Version);

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

console.log = jest.fn();

beforeAll(async () => {
    await Database.delete("DELETE FROM `tokens`");
    await Database.delete("DELETE FROM `users`");
    await Database.delete("DELETE FROM `registrations`");
    await Database.delete("DELETE FROM `members`");
    await Database.delete("DELETE FROM `postal_codes`");
    await Database.delete("DELETE FROM `cities`");
    await Database.delete("DELETE FROM `provinces`");
    
    await Database.delete("DELETE FROM `webshop_orders`");
    await Database.delete("DELETE FROM `webshops`");
    await Database.delete("DELETE FROM `groups`");
    await Database.delete("DELETE FROM `email_addresses`");

    await Database.delete("DELETE FROM `organizations`");
    
    await Database.delete("DELETE FROM `payments`");
    await Database.delete("OPTIMIZE TABLE organizations;"); // fix breaking of indexes due to deletes (mysql bug?)

    await I18n.load()
});

afterAll(async () => {
    // Wait for email queue etc
    while (Email.currentQueue.length > 0) {
        console.info("Emails still in queue. Waiting...")
        await sleep(100)
    }
    await Database.end();
});
