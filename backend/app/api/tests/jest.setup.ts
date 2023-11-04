require('@stamhoofd/backend-env').load({path: __dirname+'/../../.env.test.json'})

import { Column,Database } from "@simonbackx/simple-database";
import { Request } from '@simonbackx/simple-endpoints';
import { I18n } from "@stamhoofd/backend-i18n";
import { Version } from '@stamhoofd/structures';

// Set version of saved structures
Column.setJSONVersion(Version);

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version

//console.log = jest.fn();

beforeAll(async () => {
    await I18n.load()
});

afterAll(async () => {
    await Database.end();
});
