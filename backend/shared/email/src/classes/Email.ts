import { DataValidator, Formatter } from '@stamhoofd/utility';
import nodemailer from "nodemailer"
import Mail from 'nodemailer/lib/mailer';
import { EmailAddress } from '../models/EmailAddress';
import htmlToText from 'html-to-text';
import { sleep } from '@stamhoofd/utility';
import { I18n } from "@stamhoofd/backend-i18n"
import { SimpleError } from '@simonbackx/simple-errors';
import {type default as Postmark} from "postmark";

// Importing postmark returns undefined (this is a bug, so we need to use require)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postmark = require("postmark")

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
    headers?: Record<string, string>|null,
    callback?: (error: Error|null) => void;
}

export type EmailInterface = EmailInterfaceBase & {
    from: string;
}

/// An email builder is called until it returns undefined. This allows to reduce memory usage for an e-mail with multiple recipients
export type EmailBuilder = () => EmailInterface | undefined

type InternalEmailData = {
    from: string;
    bcc: string|undefined;
    replyTo: string|undefined;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string|Buffer; contentType?: string }[];
    headers?: Record<string, string>;
}

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

    private matchWhitelist(email: string, whitelist: string[]) {
        if (!whitelist.includes('*') && !whitelist.includes('*@*')) {
            const l = email.toLowerCase();
            if (whitelist.includes(l)) {
                return true;
            }

            const domainIndex = l.indexOf('@');
            const domain = l.substring(domainIndex)

            if (whitelist.includes('*' + domain)) {
                return true;
            }

            console.warn("Filtered email to " + l + ": not whitelisted")
            return false;
        }

        return true
    }

    private filterWhitelist(recipients: EmailInterfaceRecipient[], whitelist: string[]) {
        if (!whitelist.includes('*') && !whitelist.includes('*@*')) {
            return recipients.filter(mail => {
                return this.matchWhitelist(mail.email, whitelist)
            })
        }

        return recipients
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

            try {
                data.callback?.(
                    new SimpleError({
                        code: 'all_filtered',
                        message: "All recipients are filtered due to hard bounce or spam",
                        human: 'Alle ontvangers zijn gefilterd wegens een hard bounce of spam'
                    })
                )
            } catch (e) {
                console.error("Error in email callback", e)
            }
            return
        }

        // Filter by environment
        if (STAMHOOFD.environment !== 'production' || (STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS && STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS.length > 0)) {
            const whitelist = STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS ?? []
            recipients = this.filterWhitelist(recipients, whitelist)
        }

        if (recipients.length === 0) {
            // Invalid string
            try {
                data.callback?.(
                    new SimpleError({
                        code: 'all_filtered',
                        message: "All recipients are filtered due to environment",
                        human: 'Alle ontvangers zijn gefilterd omwille van de demo-omgeving die het versturen van bepaalde e-mails limiteert'
                    })
                )
            } catch (e) {
                console.error("Error in email callback", e)
            }
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
        const mail: InternalEmailData = {
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

        const parsedFrom = this.parseEmailStr(data.from)
        if (parsedFrom.length !== 1) {
            throw new Error("Invalid from email " + data.from)
        }

        try {
            // Can we send from the transactional email server?
            if (STAMHOOFD.TRANSACTIONAL_WHITELIST !== undefined && data.type === 'transactional') {
                if (!this.matchWhitelist(parsedFrom[0], STAMHOOFD.TRANSACTIONAL_WHITELIST)) {
                    // Not supported
                    data.type = 'broadcast'
                }
            }

            const transporter = (data.type === "transactional") ? this.transactionalTransporter : this.transporter

            if (data.type === "transactional") {
                mail.headers = {
                    ...data.headers,
                    ...STAMHOOFD.TRANSACTIONAL_SMTP_HEADERS
                }
            } else {
                mail.headers = {
                    ...data.headers,
                    ...STAMHOOFD.SMTP_HEADERS
                }
            }

            if (STAMHOOFD.POSTMARK_SERVER_TOKEN && (data.retryCount === 1)) {
                await this.sendApi(mail)
                console.log("Message sent via api:", to, data.subject, data.type);
            } else {
                const info = await transporter.sendMail(mail);
                console.log("Message sent:", to, data.subject, info.messageId, data.type);
            }
            
            try {
                data.callback?.(null)
            } catch (e) {
                console.error("Error in email callback", e)
            }
        } catch (e) {
            console.error("Failed to send e-mail:")
            console.error(e);
            console.error(mail);

            // Sleep 1 second to give servers some time to fix possible rate limits
            await sleep(1000);

            // Reschedule twice (at maximum) to fix temporary connection issues
            data.retryCount = (data.retryCount ?? 0) + 1;

            if (data.retryCount <= 2) {
                
                if (data.type === 'transactional' && data.retryCount === 2) {
                    data.type = 'broadcast';
                }
                this.send(data);
            } else {
                try {
                    data.callback?.(e)
                } catch (e2) {
                    console.error("Error in email failure callback", e2, 'for original error', e)
                }

                // Email address is not verified.
                if (STAMHOOFD.environment !== 'development') {
                    if (data.from !== this.getWebmasterFromEmail()) {
                        this.sendWebmaster({
                            subject: "E-mail kon niet worden verzonden",
                            text: "Een e-mail vanaf "+data.from+" kon niet worden verstuurd aan "+mail.to+": \n\n"+e+"\n\n"+(mail.text ?? ""),
                            type: (data.type === "transactional") ? "broadcast" : "transactional"
                        })
                    }
                }
            }
        }
    }

    private async sendApi(data: InternalEmailData) {
        if (!STAMHOOFD.POSTMARK_SERVER_TOKEN) {
            throw new Error("Missing POSTMARK_SERVER_TOKEN")
        }
        const client = new postmark.ServerClient(STAMHOOFD.POSTMARK_SERVER_TOKEN);
        const headers: {Name: string, Value: string}[] = [];
        for (const key in data.headers) {
            headers.push({ Name: key, Value: data.headers[key] });
        }

        const message: Postmark.Models.Message = {
            "From": data.from,
            "To": data.to,
            "Bcc": data.bcc,
            "Subject": data.subject,
            "TextBody": data.text,
            "HtmlBody": data.html,
            "Headers": headers,
            "ReplyTo": data.replyTo,
            "Tag": "api",
            "MessageStream": (data.headers?.["X-PM-Message-Stream"] ?? "outbound")
        };

        console.log('Falling back to Postmark API', message);

        try {
            await client.sendEmail(message);
        } catch (e) {
            console.error('Failed to send email with Postmark API', e);
            throw e;
        }

    }

    /**
     * @deprecated
     * Please use EmailBuilder.sendEmailTemplate
     */
    getInternalEmailFor(i18n: I18n) {
        // todo: use default email in platform settings
        return '"' + (STAMHOOFD.platformName ?? 'Stamhoofd') + ' " <hallo@'+ (i18n.localizedDomains.defaultTransactionalEmail()) +'>'
    }

    getWebmasterFromEmail() {
        return '"' + (STAMHOOFD.platformName ?? 'Stamhoofd') + ' " <webmaster@'+ (new I18n("nl", "BE").localizedDomains.defaultTransactionalEmail()) +'>'
    }

    getWebmasterToEmail() {
        return 'hallo@stamhoofd.be'
    }

    /**
     * @deprecated
     * Please use EmailBuilder.sendEmailTemplate
     */
    getPersonalEmailFor(i18n: I18n) {
        return '"Simon Backx" <'+ (i18n.$t("5670bc42-cf94-46b6-9ce0-7cdc4ffbb4d9")) +'>'
    }

    /**
     * Send an email to the webmaster
     */
    sendWebmaster(data: Omit<EmailInterfaceBase, "to">) {
        const mail = Object.assign(data, { 
            from: this.getWebmasterFromEmail(),
            to: this.getWebmasterToEmail()
        })
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

    scheduleAndWait(builder: EmailBuilder) {
        this.currentQueue.push(builder)
        this.sendNextIfNeeded()
    }
}

export const Email = new EmailStatic();
