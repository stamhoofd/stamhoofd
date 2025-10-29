import { Migration } from '@simonbackx/simple-database';
import { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { Address, Country } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (!STAMHOOFD.singleOrganization) {
        return;
    }

    let organization = await Organization.getByID(STAMHOOFD.singleOrganization);
    if (organization) {
        console.log('Single organization already created.');
        return;
    }

    const registrationPeriod = (await RegistrationPeriod.select().first(false)) ?? new RegistrationPeriod();
    if (!registrationPeriod.id) {
        const s = Formatter.luxon();
        const startDate = s.set({
            day: 1,
            month: 9,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        });
        const endDate = s.set({
            year: startDate.year + 1,
            day: 31,
            month: 8,
            hour: 23,
            minute: 59,
            second: 59,
            millisecond: 999,
        });
        registrationPeriod.startDate = startDate.toJSDate();
        registrationPeriod.endDate = endDate.toJSDate();
    }
    await registrationPeriod.save();

    console.log('Creating single organization...');
    organization = new Organization();
    organization.id = STAMHOOFD.singleOrganization;
    organization.name = STAMHOOFD.platformName;
    organization.uri = Formatter.slug(STAMHOOFD.platformName);
    organization.periodId = registrationPeriod.id;
    organization.address = Address.create({
        street: 'Demo',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: STAMHOOFD.fixedCountry ?? Country.Belgium,
    });

    await organization.save();

    // Do something here
    return Promise.resolve();
});
