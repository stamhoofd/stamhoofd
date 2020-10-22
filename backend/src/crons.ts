import { Organization } from './models/Organization';
import AWS from 'aws-sdk';
import { simpleParser } from 'mailparser';
import Email from './email/Email';

let isRunningCrons = false

async function checkDNS() {
    let lastId = ""

    while (true) {

        const organizations = await Organization.where({ id: { sign: '>', value: lastId } }, {
            limit: 10,
            sort: ["id"]
        })

        if (organizations.length == 0) {
            break
        }

        for (const organization of organizations) {
            console.log("Checking DNS for "+organization.name)
            await organization.updateDNSRecords()
        }

        lastId = organizations[organizations.length - 1].id
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
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
                                recipients: string[],
                                spamVerdict: { status: 'PASS' | string },
                                virusVerdict: { status: 'PASS' | string },
                                spfVerdict: { status: 'PASS' | string },
                                dkimVerdict: { status: 'PASS' | string },
                                dmarcVerdict: { status: 'PASS' | string },
                            }

                            if (receipt.spamVerdict.status != "PASS" || receipt.virusVerdict.status != "PASS" || !(receipt.spfVerdict.status == "PASS" || receipt.dkimVerdict.status == "PASS")) {
                                console.error("Received spam or virus e-mail. Ignoring")
                                continue;
                            }

                            const recipients = receipt.recipients
                            const email = recipients.find(r => r.endsWith("@stamhoofd.email"))
                            let organization: Organization | undefined = undefined

                            if (email) {
                                // find receipient
                                const uri = email.substring(0, email.length - "@stamhoofd.email".length)
                                console.log(uri)

                                organization = await Organization.getByURI(uri)
                                
                                if (!organization) {
                                    console.error("Unknown organization")
                                    // forward to stamhoofd
                                }
                            } else {
                                console.error("Unknown receipient")  
                                // forward to stamhoofd
                            }

                            // Send a new e-mail
                            const defaultEmail = organization?.privateMeta.emails.find(e => e.default)?.email ?? "hallo@stamhoofd.be"
                            console.log("Forward to "+defaultEmail)       
                            
                            const parsed = await simpleParser(content);
                            const from = parsed.from?.value[0]?.address
                            const extraDescription = from && from.endsWith("amazonses.com") ? "Er ging iets mis bij het versturen van een e-mail. Het e-mailadres is ongeldig of de ontvanger heeft de e-mail als spam gemarkeerd. Kijk na of dit lid een typefout heeft gemaakt in het e-mailadres en corrigeer dit zeker." : "Dit bericht werd verstuurd naar "+email+", en werd automatisch doorgestuurd. Normaal antwoorden gebruikers rechtstreeks naar het juiste e-mailadres maar enkele e-mail programma's ondersteunen deze standaard functionaliteit niet en sturen antwoorden altijd naar de verstuurder (en wij kunnen niet versturen vanaf jouw e-mailadres, tenzij je jouw domeinnaam instelt in Stamhoofd). Let op dat je zelf ook naar het juiste e-mailadres antwoordt ("+(from ?? "?")+").";

                            let html: string | undefined = undefined

                            if (parsed.html !== false) {
                                // Search for body
                                const body = parsed.html.toLowerCase().indexOf("<body")

                                if (body != -1) {
                                    const endTag = parsed.html.indexOf(">", body)
                                    html = parsed.html.substring(0, endTag + 1) + "<p><i>"+escapeHtml(extraDescription)+"<br><br></i></p>"+parsed.html.substring(endTag + 1)
                                } else {
                                    html = "<p><i>"+escapeHtml(extraDescription)+"<br><br></i></p>"+parsed.html
                                }
                            }

                            const options = {
                                from: email ?? recipients[0] ?? "unknown@stamhoofd.be",
                                to: defaultEmail,
                                replyTo: parsed.from?.text,
                                subject: parsed.subject ?? "Doorgestuurd bericht",
                                text: parsed.text ? extraDescription + "\n\n" + parsed.text : undefined,
                                html: html,
                                attachments: parsed.attachments.flatMap(a => {
                                    if (a.cid) {
                                        // Already done inline in html
                                        return []
                                    }
                                    return [{
                                        filename: a.filename ?? "",
                                        content: a.content.toString("utf-8"),
                                        contentType: a.contentType
                                    }]
                                })
                            }

                            Email.send(options)
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
            console.log("Received message: ");
            console.log(message.Body)

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

                                if (type === "Permanent") {
                                    console.log("Received a permanent bounce: "+email)
                                } else {
                                    if (recipient.diagnosticCode && (recipient.diagnosticCode as string).toLowerCase().includes("invalid domain")) {
                                        console.log("Invalid domain: "+email)
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

// Schedule automatic paynl charges
export const crons = () => {
    if (isRunningCrons) {
        return;
    }
    isRunningCrons = true
    try {
        checkReplies().then(() => checkBounces()).then(() => checkDNS()).catch(e => {
            console.error(e)
        }).finally(() => {
            isRunningCrons = false
        })
    } catch (e) {
        console.error(e)
        isRunningCrons = false
    }
};