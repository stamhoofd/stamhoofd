import { Database } from '@simonbackx/simple-database';
import { Email } from '@stamhoofd/email';
import { EmailAddress } from '@stamhoofd/email';
import { Group } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Registration } from '@stamhoofd/models';
import { STInvoice } from '@stamhoofd/models';
import { STPendingInvoice } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import AWS from 'aws-sdk';

import { ExchangeSTPaymentEndpoint } from './endpoints/billing/ExchangeSTPaymentEndpoint';
import { ExchangePaymentEndpoint } from './endpoints/ExchangePaymentEndpoint';
import { checkSettlements } from './helpers/CheckSettlements';
import { ForwardHandler } from './helpers/ForwardHandler';

let isRunningCrons = false


let lastDNSCheck: Date | null = null
let lastDNSId = ""
async function checkDNS() {
    // Wait an half hour between every complete check
    if (lastDNSCheck && lastDNSCheck > new Date(new Date().getTime() - 30 * 60 * 1000)) {
        console.log("Skip DNS check")
        return
    }
    
    const organizations = await Organization.where({ id: { sign: '>', value: lastDNSId } }, {
        limit: 10,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Wait an half hour before starting again
        lastDNSId = ""
        lastDNSCheck = new Date()
        return
    }

    for (const organization of organizations) {
        console.log("Checking dns for "+organization.name)
        await organization.updateDNSRecords()
    }

    lastDNSId = organizations[organizations.length - 1].id
    
}

async function checkReplies() {
    if (process.env.NODE_ENV !== "production") {
        console.log("Skippping replies checking")
        return
    }
    console.log("Checking replies from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-email-forwarding", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("Received message from forwarding queue");

            if (message.ReceiptHandle) {
                if (process.env.NODE_ENV === "production") {
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
                                if (process.env.NODE_ENV === "production") {
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

async function checkBounces() {
    if (process.env.NODE_ENV !== "production") {
        console.log("Skippping bounce checking")
        return
    }
    console.log("Checking bounces from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("Received bounce message");
            console.log(message);

            if (message.ReceiptHandle) {
                if (process.env.NODE_ENV === "production") {
                    await sqs.deleteMessage({
                        QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue",
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
                                        console.error("Unknown organization for email address "+source)
                                    }
                                }

                            }
                            console.log("For domain "+source)
                        } else {
                            console.log("'bounce' field missing in bounce message")
                        }
                    } else {
                        console.log("'Message' field missing in bounce message")
                    }
                } else {
                    console.log("Message Body missing in bounce")
                }
            } catch (e) {
                console.log("Bounce message processing failed:")
                console.error("Bounce message processing failed:")
                console.error(e)
            }
        }
    }
}

async function checkComplaints() {
    if (process.env.NODE_ENV !== "production") {
        console.log("Skippping complaints checking")
        return
    }

    console.log("Checking complaints from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("Received complaint message");
            console.log(message)

            if (message.ReceiptHandle) {
                if (process.env.NODE_ENV === "production") {
                    await sqs.deleteMessage({
                        QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-complaints-queue",
                        ReceiptHandle: message.ReceiptHandle
                    }).promise()
                    console.log("Deleted from queue");
                }
            }

            try {
                if (message.Body) {
                    // decode the JSON value
                    const complaint = JSON.parse(message.Body)
                    console.log(complaint)

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
                                console.error("Unknown organization for email address "+source)
                            }

                             if (type == "virus" || type == "fraud") {
                                console.error("Received virus / fraud complaint!")
                                console.error(complaint)
                                if (process.env.NODE_ENV === "production") {
                                    Email.sendInternal({
                                        to: "simon@stamhoofd.be",
                                        subject: "Received a "+type+" email notification",
                                        text: "We received a "+type+" notification for an e-mail from the organization: "+organization?.name+". Please check and adjust if needed.\n"
                                    })
                                }
                            }
                        } else {
                            console.log("Missing complaint field")
                        }
                    }  else {
                        console.log("Missing message field in complaint")
                    }
                }
            } catch (e) {
                console.log("Complain message processing failed:")
                console.error("Complain message processing failed:")
                console.error(e)
            }
        }
    }
}

// Keep checking pending paymetns for 3 days
async function checkPayments() {
    // todo: only select the ID + organizationId
    const payments = await Payment.where({
        status: {
            sign: "IN",
            value: [PaymentStatus.Created, PaymentStatus.Pending]
        },
        method: {
            sign: "IN",
            value: [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq, PaymentMethod.CreditCard]
        },
        createdAt: {
            sign: ">",
            value: new Date(new Date().getTime() - 60*1000*60*24*3)
        },
    }, {
        limit: 100
    })

    console.log("Checking pending payments: "+payments.length)

    for (const payment of payments) {
        try {
            if (payment.organizationId) {
                const organization = await Organization.getByID(payment.organizationId)
                if (organization) {
                    await ExchangePaymentEndpoint.pollStatus(payment.id, organization)
                }
            } else {
                // Try stamhoofd payment
                const invoices = await STInvoice.where({ paymentId: payment.id })
                if (invoices.length === 1) {
                    await ExchangeSTPaymentEndpoint.pollStatus(payment, invoices[0])
                    continue
                }
            }
        } catch (e) {
            console.error(e)
        }
    }
}

// Unreserve reserved registrations
async function checkReservedUntil() {
    console.log("Check reserved until...")
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
    console.log("Checking billing...")

    // Wait for the next day before doing a new check
    if (lastBillingCheck && Formatter.dateIso(lastBillingCheck) === Formatter.dateIso(new Date())) {
        console.log("Billing check done for today")
        return
    }
    
    const organizations = await Organization.where({ id: { sign: '>', value: lastBillingId } }, {
        limit: process.env.NODE_ENV === "development" ? 10 : 10,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Wait again until next day
        lastBillingId = ""
        lastBillingCheck = new Date()
        return
    }

    for (const organization of organizations) {
        console.log("Checking billing for "+organization.name)

        try {
            await QueueHandler.schedule("billing/invoices-"+organization.id, async () => {
                await STPendingInvoice.addItems(organization)
            });
        } catch (e) {
            console.error(e)
        }
        
    }

    lastBillingId = organizations[organizations.length - 1].id
    
}

// Schedule automatic paynl charges
export const crons = () => {
    if (isRunningCrons) {
        return;
    }
    isRunningCrons = true
    try {
        checkSettlements().then(checkBilling).then(checkReservedUntil).then(checkComplaints).then(checkReplies).then(checkBounces).then(checkDNS).then(checkPayments).catch(e => {
            console.error(e)
        }).finally(() => {
            isRunningCrons = false
        })
    } catch (e) {
        console.error(e)
        isRunningCrons = false
    }
};

export function areCronsRunning(): boolean {
    return isRunningCrons
}