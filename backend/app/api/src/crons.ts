import { Database } from '@simonbackx/simple-database';
import { Group, Organization, Payment, Registration, STPackage, Webshop } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SQL } from '@stamhoofd/sql';
import { registerCron } from '@stamhoofd/crons';
import { checkSettlements } from './helpers/CheckSettlements.js';
import { PaymentService } from './services/PaymentService.js';
import { RegistrationService } from './services/RegistrationService.js';

let lastDNSCheck: Date | null = null;
let lastDNSId = '';
async function checkDNS() {
    if (STAMHOOFD.environment === 'development') {
        return;
    }

    // Wait 6 hours between every complete check
    if (lastDNSCheck && lastDNSCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log('[DNS] Skip DNS check');
        return;
    }

    const organizations = await Organization.where({ id: { sign: '>', value: lastDNSId } }, {
        limit: 50,
        sort: ['id'],
    });

    if (organizations.length == 0) {
        // Wait an half hour before starting again
        lastDNSId = '';
        lastDNSCheck = new Date();
        return;
    }

    console.log('[DNS] Checking DNS...');

    for (const organization of organizations) {
        if (STAMHOOFD.environment === 'production') {
            console.log('[DNS] ' + organization.name);
        }
        try {
            await organization.updateDNSRecords();
        }
        catch (e) {
            console.error(e);
        }
    }

    lastDNSId = organizations[organizations.length - 1].id;
}

let lastExpirationCheck: Date | null = null;
async function checkExpirationEmails() {
    if (STAMHOOFD.environment === 'development') {
        return;
    }

    // Wait 1 hour between every complete check
    if (lastExpirationCheck && lastExpirationCheck > new Date(new Date().getTime() - 1 * 60 * 60 * 1000)) {
        console.log('[EXPIRATION EMAILS] Skip checkExpirationEmails');
        return;
    }

    // Get all packages that expire between now and 31 days
    const packages = await STPackage.where({
        validUntil: [
            { sign: '!=', value: null },
            { sign: '>', value: new Date() },
            { sign: '<', value: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31) },
        ],
        validAt: [
            { sign: '!=', value: null },
        ],
        emailCount: 0,
    });

    console.log('[EXPIRATION EMAILS] Sending expiration emails...');

    for (const pack of packages) {
        await pack.sendExpiryEmail();
    }
    lastExpirationCheck = new Date();
}

let lastWebshopDNSCheck: Date | null = null;
let lastWebshopDNSId = '';
async function checkWebshopDNS() {
    if (STAMHOOFD.environment === 'development') {
        return;
    }

    // Wait 6 hours between every complete check
    if (lastWebshopDNSCheck && lastWebshopDNSCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log('[DNS] Skip webshop DNS check');
        return;
    }

    const webshops = await Webshop.where({
        id: { sign: '>', value: lastWebshopDNSId },
        domain: { sign: '!=', value: null },
    }, {
        limit: 10,
        sort: ['id'],
    });

    if (webshops.length == 0) {
        // Wait an half hour before starting again
        lastWebshopDNSId = '';
        lastWebshopDNSCheck = new Date();
        return;
    }

    console.log('[DNS] Checking webshop DNS...');

    for (const webshop of webshops) {
        console.log('[DNS] Webshop ' + webshop.meta.name + ' (' + webshop.id + ')' + ' (' + webshop.domain + ')');
        await webshop.updateDNSRecords();
    }

    lastWebshopDNSId = webshops[webshops.length - 1].id;
}

// 11 min - 2 hours
async function checkPayments() {
    if (STAMHOOFD.environment === 'development') {
        // return;
    }

    const timeout = 60 * 1000 * 11;
    const timeout2 = 60 * 1000 * 60 * 2;

    // TODO: only select the ID + organizationId
    const payments = await Payment.select()
        .where(
            SQL.where('method', [
                PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq, PaymentMethod.CreditCard,
            ])
                .and('status', [PaymentStatus.Created, PaymentStatus.Pending])
                .and('createdAt', '<', new Date(new Date().getTime() - timeout))
                .and('createdAt', '>', new Date(new Date().getTime() - timeout2)),
        )
        // For payconiq payments, we have a shorter timeout of 1 minute if they are still in the 'created' state (not scanned)
        .orWhere(
            SQL.where('method', [
                PaymentMethod.Payconiq,
            ])
                .and('status', [PaymentStatus.Created])
                .and('createdAt', '<', new Date(new Date().getTime() - 60 * 1000))
                .and('createdAt', '>', new Date(new Date().getTime() - timeout2)),
        )
        .orderBy('createdAt', 'ASC')
        .limit(500)
        .fetch();

    console.log('[DELAYED PAYMENTS] Checking pending payments: ' + payments.length);
    await doCheckPayments(payments);
}

// 2 hours - 3 days
async function checkOldPayments() {
    if (STAMHOOFD.environment === 'development') {
        // return;
    }

    const timeout = 60 * 1000 * 60 * 2;
    const timeout2 = 60 * 1000 * 60 * 24 * 3;

    // TODO: only select the ID + organizationId
    const payments = await Payment.select()
        .where(
            SQL.where('method', [
                PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq, PaymentMethod.CreditCard,
            ])
                .and('status', [PaymentStatus.Created, PaymentStatus.Pending])
                .and('createdAt', '<', new Date(new Date().getTime() - timeout))
                .and('createdAt', '>', new Date(new Date().getTime() - timeout2)),
        )
        .orderBy('createdAt', 'ASC')
        .limit(500)
        .fetch();

    console.log('[DELAYED PAYMENTS] Checking old pending payments: ' + payments.length);
    await doCheckPayments(payments);
}

async function doCheckPayments(payments: Payment[]) {
    for (const payment of payments) {
        try {
            if (payment.organizationId) {
                const organization = await Organization.getByID(payment.organizationId);
                if (organization) {
                    await PaymentService.pollStatus(payment.id, organization);
                    continue;
                }
            }
            else {
                // deprecated
            }

            // Check expired
            if (PaymentService.isManualExpired(payment.status, payment)) {
                console.error('[DELAYED PAYMENTS] Could not resolve handler for expired payment, marking as failed', payment.id);
                payment.status = PaymentStatus.Failed;
                await payment.save();
            }
        }
        catch (e) {
            console.error(e);
        }
    }
}

let didCheckBuckaroo = false;
let lastBuckarooId = '';

// Time to start checking (needs to be consistent to avoid weird jumps)
const startBuckarooDate = new Date(new Date().getTime() - 60 * 1000 * 60 * 24 * 7 * 4);

// Keep checking pending paymetns for 3 days
async function checkFailedBuckarooPayments() {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    if (didCheckBuckaroo) {
        return;
    }

    console.log('Checking failed Buckaroo payments');

    // TODO: only select the ID + organizationId
    const payments = await Payment.where({
        status: {
            sign: 'IN',
            value: [PaymentStatus.Failed],
        },
        provider: PaymentProvider.Buckaroo,

        // Only check payments of last 4 weeks
        createdAt: {
            sign: '>',
            value: startBuckarooDate,
        },
        id: {
            sign: '>',
            value: lastBuckarooId,
        },
    }, {
        limit: 100,

        // Sort by ID
        sort: [{
            column: 'id',
            direction: 'ASC',
        }],
    });

    console.log('[BUCKAROO PAYMENTS] Checking failed payments: ' + payments.length);

    for (const payment of payments) {
        try {
            if (payment.organizationId) {
                const organization = await Organization.getByID(payment.organizationId);
                if (organization) {
                    await PaymentService.pollStatus(payment.id, organization);
                    continue;
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    if (payments.length === 0) {
        didCheckBuckaroo = true;
        lastBuckarooId = '';
    }
    else {
        lastBuckarooId = payments[payments.length - 1].id;
    }
}

// Unreserve reserved registrations
async function checkReservedUntil() {
    if (STAMHOOFD.environment !== 'development') {
        console.log('Check reserved until...');
    }

    const registrations = await Registration.where({
        reservedUntil: {
            sign: '<',
            value: new Date(),
        },
    }, {
        limit: 200,
    });

    if (registrations.length === 0) {
        return;
    }

    // Clear reservedUntil
    const q = `UPDATE ${Registration.table} SET reservedUntil = NULL where id IN (?) AND reservedUntil < ?`;
    await Database.update(q, [registrations.map(r => r.id), new Date()]);

    // Get groups
    const groupIds = registrations.map(r => r.groupId);
    const groups = await Group.where({
        id: {
            sign: 'IN',
            value: groupIds,
        },
    });

    for (const registration of registrations) {
        RegistrationService.scheduleStockUpdate(registration.id);
    }

    // Update occupancy
    for (const group of groups) {
        await group.updateOccupancy();
        await group.save();
    }
}

let lastDripCheck: Date | null = null;
let lastDripId = '';
async function checkDrips() {
    if (STAMHOOFD.environment === 'development') {
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        return;
    }

    if (lastDripCheck && lastDripCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log('Skip Drip check');
        return;
    }

    // Only send emails between 8:00 - 18:00 CET
    const CETTime = Formatter.timeIso(new Date());
    if ((CETTime < '08:00' || CETTime > '18:00') && STAMHOOFD.environment === 'production') {
        console.log('Skip Drip check: outside hours');
        return;
    }

    const organizations = await Organization.where({ id: { sign: '>', value: lastDripId } }, {
        limit: STAMHOOFD.environment === 'production' ? 30 : 100,
        sort: ['id'],
    });

    if (organizations.length == 0) {
        // Wait before starting again
        lastDripId = '';
        lastDripCheck = new Date();
        return;
    }

    console.log('Checking drips...');

    for (const organization of organizations) {
        console.log(organization.name);
        try {
            await organization.checkDrips();
        }
        catch (e) {
            console.error(e);
        }
    }

    lastDripId = organizations[organizations.length - 1].id;
}

registerCron('checkSettlements', checkSettlements);
registerCron('checkExpirationEmails', checkExpirationEmails);
registerCron('checkReservedUntil', checkReservedUntil);
registerCron('checkDNS', checkDNS);
registerCron('checkWebshopDNS', checkWebshopDNS);
registerCron('checkPayments', checkPayments);
registerCron('checkOldPayments', checkOldPayments);
registerCron('checkDrips', checkDrips);

// Register other crons
import './crons/index.js';
