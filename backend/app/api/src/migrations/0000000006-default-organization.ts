import { Migration } from '@simonbackx/simple-database';
import { Organization, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { Address, Company, File, Image, PaymentMethod, Resolution } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import { STPackageService } from '../services/STPackageService.js';

export default new Migration(async () => {
    const platform = await Platform.getForEditing();
    if (platform.membershipOrganizationId) {
        console.log('Membership organization already created.');
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

    console.log('Creating membership organization...');
    const organization = new Organization();
    organization.name = STAMHOOFD.platformName;
    organization.uri = Formatter.slug(STAMHOOFD.platformName);
    organization.periodId = registrationPeriod.id;
    organization.address = Address.create({
        street: '',
        number: '',
        postalCode: '',
        city: 'Gent',
        country: STAMHOOFD.fixedCountry ?? Country.Belgium,
    });
    organization.privateMeta.featureFlags = ['organization-receivable-balances'];

    // Setup Codawood credentials if running Stamhoofd
    if (STAMHOOFD.platformName === 'stamhoofd' && STAMHOOFD.userMode === 'organization') {
        organization.id = '57aa0001-0000-4000-8000-000000000001';
        organization.name = 'Stamhoofd';
        organization.meta.companies = [
            Company.create({
                name: 'Codawood BV',
                VATNumber: 'BE0747832683',
                companyNumber: '0747832683',
                address: Address.create({
                    street: 'Collegiebaan',
                    number: '54',
                    postalCode: '9230',
                    city: 'Wetteren',
                    country: Country.Belgium,
                }),
                administrationEmail: 'hallo@stamhoofd.be',
            }),
        ];

        organization.address = organization.meta.companies[0].address!;
        organization.meta.registrationPaymentConfiguration.enableMandates = true;
        organization.meta.invoicesEnabled = true;
        organization.meta.registrationPaymentConfiguration.paymentMethods = [
            PaymentMethod.Bancontact,
            PaymentMethod.iDEAL,
            PaymentMethod.CreditCard,
        ];

        // Logo for invoices + normal icon
        const horizontalLogo = new File({
            id: 'logo',
            size: 0,
            server: 'https://files.stamhoofd.be',
            path: 'fixtures/logo.svg',
        });

        organization.meta.horizontalLogo = Image.create({
            source: horizontalLogo,
            resolutions: [
                new Resolution({
                    file: horizontalLogo,
                    width: 1650,
                    height: 340,
                }),
            ],
        });

        const squareLogo = new File({
            id: 'square',
            size: 0,
            server: 'https://files.stamhoofd.be',
            path: 'fixtures/logo-small.svg',
        });

        organization.meta.squareLogo = Image.create({
            source: squareLogo,
            resolutions: [
                new Resolution({
                    file: squareLogo,
                    width: 1000,
                    height: 1000,
                }),
            ],
        });

        // Link a mollie token
    }

    await organization.save();

    // Set as platform organization
    platform.membershipOrganizationId = organization.id;
    await platform.save();

    // Make sure default packages are active for this organization
    await STPackageService.updateOrganizationPackages(organization.id);

    // Do something here
    return Promise.resolve();
});
