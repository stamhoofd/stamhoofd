import { DataValidator, Formatter } from '@stamhoofd/utility';
import nodemailer from "nodemailer"
import Mail from 'nodemailer/lib/mailer';
import { EmailAddress } from '../models/EmailAddress';
import htmlToText from 'html-to-text';
import { sleep } from '@stamhoofd/utility';
import { I18n } from "@stamhoofd/backend-i18n"

export type EmailInterfaceRecipient = {
    name?: string|null;
    email: string;
}

export type EmailInterfaceBase = {
    to: string|EmailInterfaceRecipient[];
    bcc?: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string|Buffer; contentType?: string }[];
    retryCount?: number;
    type?: "transactional" | "broadcast",
    headers?: Record<string, string>|null
}

export type EmailInterface = EmailInterfaceBase & {
    from: string;
}

/// An email builder is called until it returns undefined. This allows to reduce memory usage for an e-mail with multiple recipients
export type EmailBuilder = () => EmailInterface | undefined

class EmailStatic {
    transporter: Mail;
    transactionalTransporter: Mail;
    rps = 14

    currentQueue: EmailBuilder[] = []
    sending = false

    setupIfNeeded() {
        if (this.transporter) {
            return;
        }
        if (!STAMHOOFD.SMTP_HOST || !STAMHOOFD.SMTP_PORT) {
            throw new Error("Missing environment variables to send emails");
            return;
        }

        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({
            pool: true,
            host: STAMHOOFD.SMTP_HOST,
            port: STAMHOOFD.SMTP_PORT,
            auth: {
                user: STAMHOOFD.SMTP_USERNAME, // generated ethereal user
                pass: STAMHOOFD.SMTP_PASSWORD // generated ethereal password
            }
        });
        
        // create reusable transporter object using the default SMTP transport
        this.transactionalTransporter = nodemailer.createTransport({
            pool: true,
            host: STAMHOOFD.TRANSACTIONAL_SMTP_HOST,
            port: STAMHOOFD.TRANSACTIONAL_SMTP_PORT,
            auth: {
                user: STAMHOOFD.TRANSACTIONAL_SMTP_USERNAME, // generated ethereal user
                pass: STAMHOOFD.TRANSACTIONAL_SMTP_PASSWORD // generated ethereal password
            }
        });

        // verify connection configuration
        this.transporter.verify((error) => {
            if (error) {
                console.error("SMTP server not working", error);
            } else {
                console.log("SMTP server is ready to take our messages");
            }
        });

        // verify connection configuration
        this.transactionalTransporter.verify((error) => {
            if (error) {
                console.error("Transactinoal SMTP server not working", error);
            } else {
                console.log("Transactinoal SMTP server is ready to take our messages");
            }
        });
    }

    private sendNextIfNeeded() {
        if (!this.sending) {
            if (this.currentQueue.length == 0) {
                console.log("mail queue is empty")
                return
            }
            let next = this.currentQueue[0]()

            while (next === undefined) {
                this.currentQueue.shift()
                if (this.currentQueue.length == 0) {
                    console.log("mail queue is empty")
                    return
                }
                next = this.currentQueue[0]()
            }

            this.sending = true;
            this.doSend(next).catch(e => {
                console.error(e)
            }).finally(() => {
                this.sending = false
                this.sendNextIfNeeded()
            })
        }
    }

    parseTo(to: string|EmailInterfaceRecipient[]): EmailInterfaceRecipient[] {
        if (typeof to === "string") {
            return this.parseEmailStr(to).map(email => ({ email }))
        }

        // Filter invalid email addresses
        return to.filter(r => DataValidator.isEmailValid(r.email))
    }

    /**
     * Get the raw email
     */
    parseEmailStr(emailStr: string): string[] {
        let insideQuote = false
        let escaped = false
        let inAddr = false
        let email = ""
        let didFindAddr = false
        let cleanedStr = ""

        const addresses: string[] = []

        function endAddress() {
            let m: string
            if (didFindAddr) {
                m = email.trim()
            } else {
                m = cleanedStr.trim()
            }
            if (DataValidator.isEmailValid(m)) {
                addresses.push(m)
            }
            didFindAddr = false
            email = ""
            inAddr = false
            insideQuote = false
            escaped = false
            cleanedStr = ""
        }

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let index = 0; index < emailStr.length; index++) {
            const shouldEscape = escaped
            if (escaped) {
                escaped = false
            }
            const character = emailStr[index];
            if (insideQuote) {
                if (character === "\\") {
                    escaped = true
                    continue
                }
            }

            if (!shouldEscape) {
                if (character === "\"") {
                    if (insideQuote) {
                        insideQuote = false
                        continue
                    }
                    insideQuote = true
                    continue
                }

                if (!insideQuote) {
                    if (character === "<") {
                        inAddr = true
                        continue
                    }

                    if (character === ">") {
                        inAddr = false
                        didFindAddr = true
                        continue
                    }

                    if (character === ",") {
                        // End previous address
                        endAddress()
                        continue
                    }
                }
            }

            if (inAddr) {
                email += character
            }
            cleanedStr += character
        }

        endAddress()
        return addresses
    }

    private async doSend(data: EmailInterface) {
        if (STAMHOOFD.environment === 'test') {
            // Do not send any emails
            return;
        }

        // Check if this email is not marked as spam
        // Filter recipients if bounced or spam
        let recipients = this.parseTo(data.to)
        if (recipients.length === 0) {
            // Invalid string
            console.warn("Invalid e-mail string: '"+data.to+"'. E-mail skipped")
            return
        }

        // Check spam and bounces
        recipients = await EmailAddress.filterSendTo(recipients)

        if (recipients.length === 0) {
            // Invalid string
            console.warn("Filtered all emails due hard bounce or spam '"+data.to+"'. E-mail skipped")
            return
        }

        // Filter by environment
        if (STAMHOOFD.environment === 'staging') {
            recipients = recipients.filter(mail => !mail.email.includes("geen-email"))
        }
        if (STAMHOOFD.environment === 'development') {
            recipients = recipients.filter(mail => mail.email.endsWith("@stamhoofd.be") || mail.email.endsWith("@bounce-testing.postmarkapp.com"))
        }

        if (recipients.length === 0) {
            // Invalid string
            console.warn("Filtered all emails due to environment filter '"+data.to+"'. E-mail skipped")
            return
        }
    
        // Rebuild to
        const to = recipients.map((recipient) => {
            if (!recipient.name) {
                return recipient.email
            }
            const cleanedName = Formatter.emailSenderName(recipient.name)
            if (cleanedName.length < 2) {
                return recipient.email
            }
            return '"'+cleanedName+'" <'+recipient.email+'>'
        }).join(", ")

        this.setupIfNeeded();

        // send mail with defined transport object
        const mail: any = {
            from: data.from, // sender address
            bcc: (STAMHOOFD.environment === "production" || !data.bcc) ? data.bcc : "simon@stamhoofd.be",
            replyTo: data.replyTo,
            to,
            subject: data.subject, // Subject line
            text: data.text, // plain text body
        };

        if (data.attachments) {
            mail.attachments = data.attachments;
        }

        if (data.headers) {
            mail.headers = data.headers;
        }

        if (data.html) {
            mail.html = data.html;

            if (!data.text) {
                mail.text = htmlToText.fromString(data.html, {
                    wordwrap: null,
                    unorderedListItemPrefix: " - "
                });
            }
        }

        try {
            if (!data.from.includes('@stamhoofd.be') && !data.from.includes('@stamhoofd.nl')) {
                // Not supported
                data.type = 'broadcast'
            }

            const transporter = (data.type === "transactional") ? this.transactionalTransporter : this.transporter

            
            const info = await transporter.sendMail(mail);
            console.log("Message sent:", to, data.subject, info.messageId, data.type);
        } catch (e) {
            console.error("Failed to send e-mail:")
            console.error(e);
            console.error(mail);

            if (STAMHOOFD.environment === 'development') {
                return;
            }

            // Sleep 1 second to give servers some time to fix possible rate limits
            await sleep(1000);

            // Reschedule twice (at maximum) to fix temporary connection issues
            data.retryCount = (data.retryCount ?? 0) + 1;

            if (data.retryCount <= 2) {
                this.send(data);
            } else {
                // Email address is not verified.
                if (!data.from.includes("hallo@stamhoofd.be")) {
                    this.sendInternal({
                        to: "hallo@stamhoofd.be",
                        subject: "E-mail kon niet worden verzonden",
                        text: "Een e-mail vanaf "+data.from+" kon niet worden verstuurd aan "+mail.to+": \n\n"+e+"\n\n"+(mail.text ?? ""),
                        type: (data.type === "transactional") ? "broadcast" : "transactional"
                    }, new I18n("nl", "BE"))
                }
            }
        }
    }

    getInternalEmailFor(i18n: I18n) {
        return '"Stamhoofd" <'+ (i18n.$t("shared.emails.general")) +'>'
    }

    getPersonalEmailFor(i18n: I18n) {
        return '"Simon Backx" <'+ (i18n.$t("shared.emails.personal")) +'>'
    }

    /**
     * Send an internal e-mail (from stamhoofd)
     */
    sendInternal(data: EmailInterfaceBase, i18n: I18n) {
        const mail = Object.assign(data, { from: this.getInternalEmailFor(i18n) })
        this.send(mail)
    }

    send(data: EmailInterface) {
        if (STAMHOOFD.environment === 'test') {
            // Do not send any emails
            return;
        }
        let didSend = false

        this.schedule(() => {
            if (didSend) {
                return undefined
            }
            didSend = true;
            return data
        })
    }

    schedule(builder: EmailBuilder) {
        this.currentQueue.push(builder)
        this.sendNextIfNeeded()
    }
}

export const Email = new EmailStatic();
