import { Database } from '@simonbackx/simple-database';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import AWS from 'aws-sdk';
import { simpleParser } from 'mailparser';

import Email from './email/Email';
import { ExchangePaymentEndpoint } from './endpoints/ExchangePaymentEndpoint';
import { BounceHandler } from './helpers/BounceHandler';
import { EmailAddress } from './models/EmailAddress';
import { Group } from './models/Group';
import { Organization } from './models/Organization';
import { Payment } from './models/Payment';
import { Registration } from './models/Registration';

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

                            const options = await BounceHandler.handle(content, receipt)
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
    console.log("Checking bounces from AWS SQS")
    const sqs = new AWS.SQS();
    const messages = await sqs.receiveMessage({ QueueUrl: "https://sqs.eu-west-1.amazonaws.com/118244293157/stamhoofd-bounces-queue", MaxNumberOfMessages: 10 }).promise()
    if (messages.Messages) {
        for (const message of messages.Messages) {
            console.log("Received bounce message");

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

                        if (message.notificationType && message.notificationType == "Bounce" && message.bounce) {
                            const b = message.bounce
                            // Block all receivers that generate a permanent bounce
                            const type = b.bounceType

                            const source = message.mail.source

                            // try to find organization that is responsible for this e-mail address

                            for (const recipient of b.bouncedRecipients) {
                                const email = recipient.emailAddress

                                if (type === "Permanent" || (recipient.diagnosticCode && (recipient.diagnosticCode as string).toLowerCase().includes("invalid domain"))) {
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
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        }
    }
}

async function checkComplaints() {
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

                        if (message.notificationType && message.notificationType == "Complaint" && message.complaint) {
                            const b = message.complaint
                            const source = message.mail.source
                            const organization: Organization | undefined = source ? await Organization.getByEmail(source) : undefined

                            const type: "abuse" | "auth-failure" | "fraud" | "not-spam" | "other" | "virus" = b.complaintFeedbackType

                            console.log(type)

                           
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
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        }
    }
}

// Keep checking pending paymetns for 3 days
async function checkPayments() {
    const payments = await Payment.where({
        status: {
            sign: "IN",
            value: [PaymentStatus.Created, PaymentStatus.Pending]
        },
        method: {
            sign: "IN",
            value: [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq]
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
        if (payment.organizationId) {
            const organization = await Organization.getByID(payment.organizationId)
            if (organization) {
                await ExchangePaymentEndpoint.pollStatus(payment, organization)
            }
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

// Schedule automatic paynl charges
export const crons = () => {
    if (isRunningCrons) {
        return;
    }
    isRunningCrons = true
    try {
        checkReservedUntil().then(checkComplaints).then(checkReplies).then(checkBounces).then(checkDNS).then(checkPayments).catch(e => {
            console.error(e)
        }).finally(() => {
            isRunningCrons = false
        })
    } catch (e) {
        console.error(e)
        isRunningCrons = false
    }
};