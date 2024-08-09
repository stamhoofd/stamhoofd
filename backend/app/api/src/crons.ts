import { Database } from '@simonbackx/simple-database';
import { logger, StyledText } from "@simonbackx/simple-logging";
import { I18n } from '@stamhoofd/backend-i18n';
import { Email } from '@stamhoofd/email';
import { EmailAddress } from '@stamhoofd/email';
import { Group, STPackage, Webshop } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Registration } from '@stamhoofd/models';
import { STInvoice } from '@stamhoofd/models';
import { STPendingInvoice } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { Formatter, sleep } from '@stamhoofd/utility';
import AWS from 'aws-sdk';
import { DateTime } from 'luxon';

import { ExchangeSTPaymentEndpoint } from './endpoints/global/payments/ExchangeSTPaymentEndpoint';
import { ExchangePaymentEndpoint } from './endpoints/organization/shared/ExchangePaymentEndpoint';
import { checkSettlements } from './helpers/CheckSettlements';
import { ForwardHandler } from './helpers/ForwardHandler';

// Importing postmark returns undefined (this is a bug, so we need to use require)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postmark = require("postmark")

let lastDNSCheck: Date | null = null
let lastDNSId = ""
async function checkDNS() {
    if (STAMHOOFD.environment === "development") {
        return;
    }

    // Wait 6 hours between every complete check
    if (lastDNSCheck && lastDNSCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log("[DNS] Skip DNS check")
        return
    }
    
    const organizations = await Organization.where({ id: { sign: '>', value: lastDNSId } }, {
        limit: 50,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Wait an half hour before starting again
        lastDNSId = ""
        lastDNSCheck = new Date()
        return
    }

    console.log("[DNS] Checking DNS...")

    for (const organization of organizations) {
        if (STAMHOOFD.environment === "production") {
            console.log("[DNS] "+organization.name)
        }
        try {
            await organization.updateDNSRecords()
        } catch (e) {
            console.error(e);
        }
    }

    lastDNSId = organizations[organizations.length - 1].id
    
}

let lastExpirationCheck: Date | null = null
async function checkExpirationEmails() {
    if (STAMHOOFD.environment === "development") {
        return;
    }

    // Wait 1 hour between every complete check
    if (lastExpirationCheck && lastExpirationCheck > new Date(new Date().getTime() - 1 * 60 * 60 * 1000)) {
        console.log("[EXPIRATION EMAILS] Skip checkExpirationEmails")
        return
    }
    
    // Get all packages that expire between now and 31 days
    const packages = await STPackage.where({ 
        validUntil: [
            { sign: '!=', value: null },
            { sign: '>', value: new Date() },
            { sign: '<', value: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31) }
        ],
        validAt: [
            { sign: '!=', value: null },
        ],
        emailCount: 0
    })

    console.log("[EXPIRATION EMAILS] Sending expiration emails...")

    for (const pack of packages) {
        await pack.sendExpiryEmail()
    }   
    lastExpirationCheck = new Date() 
}

let lastWebshopDNSCheck: Date | null = null
let lastWebshopDNSId = ""
async function checkWebshopDNS() {
    if (STAMHOOFD.environment === "development") {
        return;
    }

    // Wait 6 hours between every complete check
    if (lastWebshopDNSCheck && lastWebshopDNSCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log("[DNS] Skip webshop DNS check")
        return
    }
    
    const webshops = await Webshop.where({ 
        id: { sign: '>', value: lastWebshopDNSId },
        domain: { sign: '!=', value: null }
    }, {
        limit: 10,
        sort: ["id"]
    })

    if (webshops.length == 0) {
        // Wait an half hour before starting again
        lastWebshopDNSId = ""
        lastWebshopDNSCheck = new Date()
        return
    }

    console.log("[DNS] Checking webshop DNS...")

    for (const webshop of webshops) {
        if (STAMHOOFD.environment === "production" || true) {
            console.log("[DNS] Webshop "+webshop.meta.name+" ("+webshop.id+")"+" ("+webshop.domain+")")
        }
        await webshop.updateDNSRecords()
    }

    lastWebshopDNSId = webshops[webshops.length - 1].id
}

async function checkReplies() {
    if (STAMHOOFD.environment !== "production") {
        return;
    }

    console.log("Checking replies from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-email-forwarding", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("Received message from forwarding queue");

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === "production") {
                    await sqs.deleteMessage({
                        QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-email-forwarding",
                        ReceiptHandle: message.ReceiptHandle
                    }).promise()
                    console.log("Deleted from queue");
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const bounce = JSON.parse(message.Body)

                    if (bounce.Message) {
                        const message = JSON.parse(bounce.Message)

                        // Read message content
                        if (message.mail && message.content && message.receipt) {
                            const content = message.content;
                            const receipt = message.receipt as {
                                recipients: string[];
                                spamVerdict: { status: 'PASS' | string };
                                virusVerdict: { status: 'PASS' | string };
                                spfVerdict: { status: 'PASS' | string };
                                dkimVerdict: { status: 'PASS' | string };
                                dmarcVerdict: { status: 'PASS' | string };
                            }

                            const options = await ForwardHandler.handle(content, receipt)
                            if (options) {
                                if (STAMHOOFD.environment === "production") {
                                    Email.send(options)
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        }
    }
}

let lastPostmarkCheck: Date | null = null
let lastPostmarkId: string | null = null
async function checkPostmarkBounces() {
    if (STAMHOOFD.environment !== "production") {
        return;
    }
    
    const token = STAMHOOFD.POSTMARK_SERVER_TOKEN
    if (!token) {
        console.log("[POSTMARK BOUNCES] No postmark token, skipping postmark bounces")
        return
    }
    const fromDate = (lastPostmarkCheck ?? new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 2))
    const ET = DateTime.fromJSDate(fromDate).setZone('EST').toISO({ includeOffset: false})
    console.log("[POSTMARK BOUNCES] Checking bounces from Postmark since", fromDate, ET)
    const client = new postmark.ServerClient(token);

    const bounces = await client.getBounces({
        fromdate: ET,
        todate: DateTime.now().setZone('EST').toISO({ includeOffset: false}),
        count: 500,
        offset: 0
    })

    if (bounces.TotalCount == 0) {
        console.log("[POSTMARK BOUNCES] No Postmark bounces at this time")
        return
    }

    let lastId: string | null = null

    for (const bounce of bounces.Bounces) {
        // Try to get the organization, if possible, else default to global blocking: "null", which is not visible for an organization, but it is applied
        const source = bounce.From
        const organization = source ? await Organization.getByEmail(source) : undefined

        if (bounce.Type === "HardBounce" || bounce.Type === "BadEmailAddress" || bounce.Type === "Blocked") {
            // Block for everyone, but not visible
            console.log("[POSTMARK BOUNCES] Postmark "+bounce.Type+" for: ", bounce.Email, "from", source, "organization", organization?.name)
            const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null)
            emailAddress.hardBounce = true
            await emailAddress.save()
        } else if (bounce.Type === "SpamComplaint" || bounce.Type === "SpamNotification" || bounce.Type === "VirusNotification") {
            console.log("[POSTMARK BOUNCES] Postmark "+bounce.Type+" for: ", bounce.Email, "from", source, "organization", organization?.name)
            const emailAddress = await EmailAddress.getOrCreate(bounce.Email, organization?.id ?? null)
            emailAddress.markedAsSpam = true
            await emailAddress.save()
        } else {
            console.log("[POSTMARK BOUNCES] Unhandled Postmark "+bounce.Type+": ", bounce.Email, "from", source, "organization", organization?.name)
            console.error("[POSTMARK BOUNCES] Unhandled Postmark "+bounce.Type+": ", bounce.Email, "from", source, "organization", organization?.name)
        }

        const bouncedAt = new Date(bounce.BouncedAt)
        lastPostmarkCheck = lastPostmarkCheck ? new Date(Math.max(bouncedAt.getTime(), lastPostmarkCheck.getTime())) : bouncedAt

        lastId = bounce.ID
    }

    if (lastId && lastPostmarkId) {
        if (lastId === lastPostmarkId) {
            console.log("[POSTMARK BOUNCES] Postmark has no new bounces")
            // Increase timestamp by one second to avoid refetching it every time
            if (lastPostmarkCheck) {
                lastPostmarkCheck = new Date(lastPostmarkCheck.getTime() + 1000)
            }
        }
    }
    lastPostmarkId = lastId
}

async function checkBounces() {
    if (STAMHOOFD.environment !== "production") {
        return
    }
    
    console.log("[AWS BOUNCES] Checking bounces from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("[AWS BOUNCES] Received bounce message");
            console.log("[AWS BOUNCES]", message);

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === "production") {
                    await sqs.deleteMessage({
                        QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue",
                        ReceiptHandle: message.ReceiptHandle
                    }).promise()
                    console.log("[AWS BOUNCES] Deleted from queue");
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const bounce = JSON.parse(message.Body)

                    if (bounce.Message) {
                        const message = JSON.parse(bounce.Message)

                        if (message.bounce) {
                            const b = message.bounce
                            // Block all receivers that generate a permanent bounce
                            const type = b.bounceType

                            const source = message.mail.source

                            // try to find organization that is responsible for this e-mail address

                            for (const recipient of b.bouncedRecipients) {
                                const email = recipient.emailAddress

                                if (
                                    type === "Permanent" 
                                    || (
                                        recipient.diagnosticCode && (
                                            (recipient.diagnosticCode as string).toLowerCase().includes("invalid domain") 
                                            || (recipient.diagnosticCode as string).toLowerCase().includes('unable to lookup dns')
                                        )
                                    )
                                ) {
                                    const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined
                                    if (organization) {
                                        const emailAddress = await EmailAddress.getOrCreate(email, organization.id)
                                        emailAddress.hardBounce = true
                                        await emailAddress.save()
                                    } else {
                                        console.error("[AWS BOUNCES] Unknown organization for email address "+source)
                                    }
                                }

                            }
                            console.log("[AWS BOUNCES] For domain "+source)
                        } else {
                            console.log("[AWS BOUNCES] 'bounce' field missing in bounce message")
                        }
                    } else {
                        console.log("[AWS BOUNCES] 'Message' field missing in bounce message")
                    }
                } else {
                    console.log("[AWS BOUNCES] Message Body missing in bounce")
                }
            } catch (e) {
                console.log("[AWS BOUNCES] Bounce message processing failed:")
                console.error("[AWS BOUNCES] Bounce message processing failed:")
                console.error("[AWS BOUNCES]", e)
            }
        }
    }
}

async function checkComplaints() {
    if (STAMHOOFD.environment !== "production") {
        return
    }

    console.log("[AWS COMPLAINTS] Checking complaints from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("[AWS COMPLAINTS] Received complaint message");
            console.log("[AWS COMPLAINTS]", message)

            if (message.ReceiptHandle) {
                if (STAMHOOFD.environment === "production") {
                    await sqs.deleteMessage({
                        QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue",
                        ReceiptHandle: message.ReceiptHandle
                    }).promise()
                    console.log("[AWS COMPLAINTS] Deleted from queue");
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const complaint = JSON.parse(message.Body)
                    console.log("[AWS COMPLAINTS]", complaint)

                    if (complaint.Message) {
                        const message = JSON.parse(complaint.Message)

                        if (message.complaint) {
                            const b = message.complaint
                            const source = message.mail.source
                            const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined

                            const type: "abuse" | "auth-failure" | "fraud" | "not-spam" | "other" | "virus" = b.complaintFeedbackType

                            if (organization) {
                                for (const recipient of b.complainedRecipients) {
                                    const email = recipient.emailAddress
                                    const emailAddress = await EmailAddress.getOrCreate(email, organization.id)
                                    emailAddress.markedAsSpam = type !== "not-spam"
                                    await emailAddress.save()
                                }
                            } else {
                                console.error("[AWS COMPLAINTS] Unknown organization for email address "+source)
                            }

                             if (type == "virus" || type == "fraud") {
                                console.error("[AWS COMPLAINTS] Received virus / fraud complaint!")
                                console.error("[AWS COMPLAINTS]", complaint)
                                if (STAMHOOFD.environment === "production") {
                                    Email.sendInternal({
                                        to: "simon@stamhoofd.be",
                                        subject: "Received a "+type+" email notification",
                                        text: "We received a "+type+" notification for an e-mail from the organization: "+organization?.name+". Please check and adjust if needed.\n"
                                    }, new I18n("nl", "BE"))
                                }
                            }
                        } else {
                            console.log("[AWS COMPLAINTS] Missing complaint field")
                        }
                    }  else {
                        console.log("[AWS COMPLAINTS] Missing message field in complaint")
                    }
                }
            } catch (e) {
                console.log("[AWS COMPLAINTS] Complain message processing failed:")
                console.error("[AWS COMPLAINTS] Complain message processing failed:")
                console.error("[AWS COMPLAINTS]", e)
            }
        }
    }
}

// Keep checking pending paymetns for 3 days
async function checkPayments() {
    if (STAMHOOFD.environment === "development") {
        return;
    }

    const timeout = 60*1000*31;
    
    // TODO: only select the ID + organizationId
    const payments = await Payment.where({
        status: {
            sign: "IN",
            value: [PaymentStatus.Created, PaymentStatus.Pending]
        },
        method: {
            sign: "IN",
            value: [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq, PaymentMethod.CreditCard]
        },
        // Check all payments that are 11 minutes old and are still pending
        createdAt: {
            sign: "<",
            value: new Date(new Date().getTime() - timeout)
        },
    }, {
        limit: 100,

        // Return oldest payments first
        // If at some point, they are still pending after 1 day, their status should change to failed
        sort: [{
            column: 'createdAt',
            direction: 'ASC'
        }]
    })

    console.log("[DELAYED PAYMENTS] Checking pending payments: "+payments.length)

    for (const payment of payments) {
        try {
            if (payment.organizationId) {
                const organization = await Organization.getByID(payment.organizationId)
                if (organization) {
                    await ExchangePaymentEndpoint.pollStatus(payment.id, organization)
                    continue;
                }
            } else {
                // Try stamhoofd payment
                const invoices = await STInvoice.where({ paymentId: payment.id })
                if (invoices.length === 1) {
                    await ExchangeSTPaymentEndpoint.pollStatus(payment, invoices[0])
                    continue
                }
            }

            // Check expired
            if (ExchangePaymentEndpoint.isManualExpired(payment.status, payment)) {
                console.error('[DELAYED PAYMENTS] Could not resolve handler for expired payment, marking as failed', payment.id)
                payment.status = PaymentStatus.Failed
                await payment.save()
            }
        } catch (e) {
            console.error(e)
        }
    }
}

let didCheckBuckaroo = false;
let lastBuckarooId = '';

// Time to start checking (needs to be consistent to avoid weird jumps)
const startBuckarooDate = new Date(new Date().getTime() - 60*1000*60*24*7*4);

// Keep checking pending paymetns for 3 days
async function checkFailedBuckarooPayments() {
    if (STAMHOOFD.environment !== "production") {
        return
    }

    if (didCheckBuckaroo) {
        return
    }

    console.log('Checking failed Buckaroo payments')
    
    // TODO: only select the ID + organizationId
    const payments = await Payment.where({
        status: {
            sign: "IN",
            value: [PaymentStatus.Failed]
        },
        provider: PaymentProvider.Buckaroo,

        // Only check payments of last 4 weeks
        createdAt: {
            sign: ">",
            value: startBuckarooDate
        },
        id: {
            sign: ">",
            value: lastBuckarooId
        }
    }, {
        limit: 100,

        // Sort by ID
        sort: [{
            column: 'id',
            direction: 'ASC'
        }]
    })

    console.log("[BUCKAROO PAYMENTS] Checking failed payments: "+payments.length)

    for (const payment of payments) {
        try {
            if (payment.organizationId) {
                const organization = await Organization.getByID(payment.organizationId)
                if (organization) {
                    await ExchangePaymentEndpoint.pollStatus(payment.id, organization)
                    continue;
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    if (payments.length === 0) {
        didCheckBuckaroo = true
        lastBuckarooId = ''
    } else {
        lastBuckarooId = payments[payments.length - 1].id
    }
}

// Unreserve reserved registrations
async function checkReservedUntil() {
    if (STAMHOOFD.environment !== "development") {
        console.log("Check reserved until...")
    }

    const registrations = await Registration.where({
        reservedUntil: {
            sign: "<",
            value: new Date()
        },
    }, {
        limit: 200
    })

    if (registrations.length === 0) {
        return
    }

    // Clear reservedUntil
    const q = `UPDATE ${Registration.table} SET reservedUntil = NULL where id IN (?) AND reservedUntil < ?`
    await Database.update(q, [registrations.map(r => r.id), new Date()])

    // Get groups
    const groupIds = registrations.map(r => r.groupId)
    const groups = await Group.where({
        id: {
            sign: "IN",
            value: groupIds
        }
    })

    // Update occupancy
    for (const group of groups) {
        await group.updateOccupancy()
        await group.save()
    }
}


// Wait for midnight before checking billing
let lastBillingCheck: Date | null = new Date()
let lastBillingId = ""
async function checkBilling() {
    if (STAMHOOFD.environment === "development") {
        return
    }

    console.log("[BILLING] Checking billing...")

    // Wait for the next day before doing a new check
    if (lastBillingCheck && Formatter.dateIso(lastBillingCheck) === Formatter.dateIso(new Date())) {
        console.log("[BILLING] Billing check done for today")
        return
    }
    
    const organizations = await Organization.where({ id: { sign: '>', value: lastBillingId } }, {
        limit: 10,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Wait again until next day
        lastBillingId = ""
        lastBillingCheck = new Date()
        return
    }

    for (const organization of organizations) {
        console.log("[BILLING] Checking billing for "+organization.name)

        try {
            await QueueHandler.schedule("billing/invoices-"+organization.id, async () => {
                await STPendingInvoice.addAutomaticItems(organization)
            });
        } catch (e) {
            console.error(e)
        }
        
    }

    lastBillingId = organizations[organizations.length - 1].id
    
}

let lastDripCheck: Date | null = null
let lastDripId = ""
async function checkDrips() {
    if (STAMHOOFD.environment === "development") {
        //return;
    }

    if (lastDripCheck && lastDripCheck > new Date(new Date().getTime() - 6 * 60 * 60 * 1000)) {
        console.log("Skip Drip check")
        return
    }

    // Only send emails between 8:00 - 18:00 CET
    const CETTime = Formatter.timeIso(new Date())
    if ((CETTime < "08:00" || CETTime > "18:00") && STAMHOOFD.environment === "production") {
        console.log("Skip Drip check: outside hours")
        return;
    }
    
    const organizations = await Organization.where({ id: { sign: '>', value: lastDripId } }, {
        limit: STAMHOOFD.environment === "production" ? 30 : 100,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Wait before starting again
        lastDripId = ""
        lastDripCheck = new Date()
        return
    }

    console.log("Checking drips...")

    for (const organization of organizations) {
        console.log(organization.name)
        try {
            await organization.checkDrips()
        } catch (e) {
            console.error(e);
        }
    }

    lastDripId = organizations[organizations.length - 1].id
    
}

type CronJobDefinition = {
    name: string,
    method: () => Promise<void>,
    running: boolean
}

const registeredCronJobs: CronJobDefinition[] = []

registeredCronJobs.push({
    name: 'checkSettlements',
    method: checkSettlements,
    running: false
});

registeredCronJobs.push({
    name: 'checkFailedBuckarooPayments',
    method: checkFailedBuckarooPayments,
    running: false
});

registeredCronJobs.push({
    name: 'checkExpirationEmails',
    method: checkExpirationEmails,
    running: false
});

registeredCronJobs.push({
    name: 'checkPostmarkBounces',
    method: checkPostmarkBounces,
    running: false
});

registeredCronJobs.push({
    name: 'checkBilling',
    method: checkBilling,
    running: false
});

registeredCronJobs.push({
    name: 'checkReservedUntil',
    method: checkReservedUntil,
    running: false
});

registeredCronJobs.push({
    name: 'checkComplaints',
    method: checkComplaints,
    running: false
});

registeredCronJobs.push({
    name: 'checkReplies',
    method: checkReplies,
    running: false
});

registeredCronJobs.push({
    name: 'checkBounces',
    method: checkBounces,
    running: false
});

registeredCronJobs.push({
    name: 'checkDNS',
    method: checkDNS,
    running: false
});

registeredCronJobs.push({
    name: 'checkWebshopDNS',
    method: checkWebshopDNS,
    running: false
});

registeredCronJobs.push({
    name: 'checkPayments',
    method: checkPayments,
    running: false
});

registeredCronJobs.push({
    name: 'checkDrips',
    method: checkDrips,
    running: false
});

async function run(name: string, handler: () => Promise<void>) {
    try {
        await logger.setContext({
            prefixes: [
                new StyledText(`[${name}] `).addClass('crons', 'tag')
            ],
            tags: ['crons']
        }, async () => {
            try {
                await handler()
            } catch (e) {
                console.error(new StyledText(e).addClass('error'))
            }
        })
    } catch (e) {
        console.error(new StyledText(e).addClass('error'))
    }
}

let stopCrons = false;
export function stopCronScheduling() {
    stopCrons = true;
}

let schedulingJobs = false;
export function areCronsRunning(): boolean {
    if (schedulingJobs && !stopCrons) {
        return true
    }

    for (const job of registeredCronJobs) {
        if (job.running) {
            return true
        }
    }
    return false
}

export const crons = async () => {
    if (STAMHOOFD.CRONS_DISABLED) {
        console.log("Crons are disabled. Make sure to enable them in the environment variables.")
        return;
    }
    
    schedulingJobs = true;
    for (const job of registeredCronJobs) {
        if (stopCrons) {
            break;
        }
        if (job.running) {
            continue;
        }
        job.running = true
        run(job.name, job.method).finally(() => {
            job.running = false
        }).catch(e => {
            console.error(e)
        });

        // Prevent starting too many jobs at once
        if (STAMHOOFD.environment !== "development") {
            await sleep(10 * 1000);
        }
    }
    schedulingJobs = false;
};
