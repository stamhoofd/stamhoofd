import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Country, Language } from '@stamhoofd/structures';
import { DataValidator, Formatter, sleep } from '@stamhoofd/utility';
import htmlToText from 'html-to-text';
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { EmailAddress } from '../models/EmailAddress';

export type EmailInterfaceRecipient = {
    name?: string | null;
    email: string;
};

export type EmailInterfaceBase = {
    to: EmailInterfaceRecipient[];
    bcc?: EmailInterfaceRecipient[];
    replyTo?: EmailInterfaceRecipient;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string; encoding?: string }[];
    retryCount?: number;
    type?: 'transactional' | 'broadcast';
    headers?: Record<string, string> | null;
    callback?: (error: Error | null) => void;
};

export type EmailInterface = EmailInterfaceBase & {
    from: EmailInterfaceRecipient;
};

/// An email builder is called until it returns undefined. This allows to reduce memory usage for an e-mail with multiple recipients
export type EmailBuilder = () => EmailInterface | undefined;

export type InternalEmailData = {
    from: string;
    bcc: string | undefined;
    replyTo: string | undefined;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string }[];
    headers?: Record<string, string>;
};

function emailObjectToString(email: null | undefined): undefined;
function emailObjectToString(email: EmailInterfaceRecipient): string;
function emailObjectToString(email: EmailInterfaceRecipient | null | undefined): string | undefined {
    if (!email) {
        return;
    }
    if (email.name) {
        const cleaned = Formatter.emailSenderName(email.name);
        if (cleaned.length < 2) {
            return email.email;
        }
        return '"' + email.name.replaceAll('"', '') + '" <' + email.email + '>';
    }
    return email.email;
}

function emailObjectsToString(emails: EmailInterfaceRecipient[]): string | undefined {
    if (emails.length === 0) {
        return;
    }
    return emails.map(emailObjectToString).join(', ');
}

class EmailStatic {
    transporter: Mail;
    transactionalTransporter: Mail;
    rps = 14;

    currentQueue: EmailBuilder[] = [];
    sending = false;

    setupIfNeeded() {
        if (this.transporter) {
            return;
        }

        if (STAMHOOFD.environment === 'test') {
            throw new Error('When using Email in tests, make sure to use EmailMocker.infect() in jest.setup.ts');
        }

        if (!STAMHOOFD.SMTP_HOST || !STAMHOOFD.SMTP_PORT) {
            throw new Error('Missing environment variables to send emails');
        }

        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({
            pool: true,
            host: STAMHOOFD.SMTP_HOST,
            port: STAMHOOFD.SMTP_PORT,
            auth: {
                user: STAMHOOFD.SMTP_USERNAME, // generated ethereal user
                pass: STAMHOOFD.SMTP_PASSWORD, // generated ethereal password
            },
        });

        // create reusable transporter object using the default SMTP transport
        this.transactionalTransporter = nodemailer.createTransport({
            pool: true,
            host: STAMHOOFD.TRANSACTIONAL_SMTP_HOST,
            port: STAMHOOFD.TRANSACTIONAL_SMTP_PORT,
            auth: {
                user: STAMHOOFD.TRANSACTIONAL_SMTP_USERNAME, // generated ethereal user
                pass: STAMHOOFD.TRANSACTIONAL_SMTP_PASSWORD, // generated ethereal password
            },
        });

        // verify connection configuration
        this.transporter.verify((error) => {
            if (error) {
                console.error('SMTP server not working', error);
            }
            else {
                console.log('SMTP server is ready to take our messages');
            }
        });

        // verify connection configuration
        this.transactionalTransporter.verify((error) => {
            if (error) {
                console.error('Transactinoal SMTP server not working', error);
            }
            else {
                console.log('Transactinoal SMTP server is ready to take our messages');
            }
        });
    }

    private sendNextIfNeeded() {
        if (!this.sending) {
            if (this.currentQueue.length == 0) {
                console.log('mail queue is empty');
                return;
            }
            let next = this.currentQueue[0]();

            while (next === undefined) {
                this.currentQueue.shift();
                if (this.currentQueue.length == 0) {
                    console.log('mail queue is empty');
                    return;
                }
                next = this.currentQueue[0]();
            }

            this.sending = true;
            this.doSend(next).catch((e) => {
                console.error(e);
                if (next.callback) {
                    next.callback(e);
                }
            }).finally(() => {
                this.sending = false;
                this.sendNextIfNeeded();
            });
        }
    }

    parseTo(to: string | EmailInterfaceRecipient[]): EmailInterfaceRecipient[] {
        if (typeof to === 'string') {
            return this.parseEmailStr(to).map(email => ({ email }));
        }

        // Filter invalid email addresses
        return to.filter(r => DataValidator.isEmailValid(r.email));
    }

    /**
     * Get the raw email
     */
    parseEmailStr(emailStr: string): string[] {
        let insideQuote = false;
        let escaped = false;
        let inAddr = false;
        let email = '';
        let didFindAddr = false;
        let cleanedStr = '';

        const addresses: string[] = [];

        function endAddress() {
            let m: string;
            if (didFindAddr) {
                m = email.trim();
            }
            else {
                m = cleanedStr.trim();
            }
            if (DataValidator.isEmailValid(m)) {
                addresses.push(m);
            }
            didFindAddr = false;
            email = '';
            inAddr = false;
            insideQuote = false;
            escaped = false;
            cleanedStr = '';
        }

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let index = 0; index < emailStr.length; index++) {
            const shouldEscape = escaped;
            if (escaped) {
                escaped = false;
            }
            const character = emailStr[index];
            if (insideQuote) {
                if (character === '\\') {
                    escaped = true;
                    continue;
                }
            }

            if (!shouldEscape) {
                if (character === '"') {
                    if (insideQuote) {
                        insideQuote = false;
                        continue;
                    }
                    insideQuote = true;
                    continue;
                }

                if (!insideQuote) {
                    if (character === '<') {
                        inAddr = true;
                        continue;
                    }

                    if (character === '>') {
                        inAddr = false;
                        didFindAddr = true;
                        continue;
                    }

                    if (character === ',') {
                        // End previous address
                        endAddress();
                        continue;
                    }
                }
            }

            if (inAddr) {
                email += character;
            }
            cleanedStr += character;
        }

        endAddress();
        return addresses;
    }

    private matchWhitelist(email: string, whitelist: string[]) {
        if (!whitelist.includes('*') && !whitelist.includes('*@*')) {
            const l = email.toLowerCase();
            if (whitelist.includes(l)) {
                return true;
            }

            const domainIndex = l.indexOf('@');
            const domain = l.substring(domainIndex);

            if (whitelist.includes('*' + domain)) {
                return true;
            }

            if (STAMHOOFD.environment === 'production') {
                console.warn('Filtered email ' + l + ': not whitelisted');
            }
            return false;
        }

        return true;
    }

    private filterWhitelist(recipients: EmailInterfaceRecipient[], whitelist: string[]) {
        if (!whitelist.includes('*') && !whitelist.includes('*@*')) {
            return recipients.filter((mail) => {
                return this.matchWhitelist(mail.email, whitelist);
            });
        }

        return recipients;
    }

    private async doSend(data: EmailInterface) {
        let recipients = data.to.filter(({ email }) => DataValidator.isEmailValid(email));

        // Check if this email is not marked as spam
        // Filter recipients if bounced or spam
        if (recipients.length === 0) {
            // Invalid string
            console.warn('No recipients for email');

            try {
                data.callback?.(
                    new SimpleError({
                        code: 'invalid_email_address',
                        message: 'Invalid email address',
                        human: $t(`cbbff442-758c-4f76-b8c2-26bb176fefcc`),
                    }),
                );
            }
            catch (e) {
                console.error('Error in email callback', e);
            }
            return;
        }

        // Check spam and bounces
        recipients = await EmailAddress.filterSendTo(recipients);

        if (recipients.length === 0) {
            // Invalid string
            console.warn("Filtered all emails due hard bounce or spam '" + data.to + "'. E-mail skipped");

            try {
                data.callback?.(
                    new SimpleError({
                        code: 'all_filtered',
                        message: 'All recipients are filtered due to hard bounce or spam',
                        human: data.to.length > 1 ? $t(`e3c3f519-562e-4ef4-b670-599ce4cb74ac`) : $t('212d39e4-8da5-4096-84bb-bd7fadc192fc'),
                    }),
                );
            }
            catch (e) {
                console.error('Error in email callback', e);
            }
            return;
        }

        // Filter by environment
        if (STAMHOOFD.environment !== 'production' || (STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS && STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS.length > 0)) {
            const whitelist = STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS ?? [];
            recipients = this.filterWhitelist(recipients, whitelist);
        }

        const to = emailObjectsToString(recipients);

        if (!to || recipients.length === 0) {
            // Invalid string
            try {
                data.callback?.(
                    new SimpleError({
                        code: 'email_skipped_whitelist',
                        message: 'All recipients are filtered due to environment',
                        human: data.to.length > 1 ? $t(`462d5e22-af11-40de-9e16-eda1b93ac0c7`) : $t('e2eeb4a3-2c32-4ba2-b991-3e139402225f'),
                    }),
                );
            }
            catch (e) {
                console.error('Error in email callback', e);
            }
            return;
        }

        // Clean bcc
        let bccRecipients: EmailInterfaceRecipient[] = [];
        if (data.bcc) {
            // Filter
            bccRecipients.push(...(await EmailAddress.filterSendTo(data.bcc.filter(({ email }) => DataValidator.isEmailValid(email)))));

            // Filter by environment
            if (STAMHOOFD.environment !== 'production' || (STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS && STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS.length > 0)) {
                const whitelist = STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS ?? [];
                bccRecipients = this.filterWhitelist(bccRecipients, whitelist);
            }
        }
        this.setupIfNeeded();

        // send mail with defined transport object
        const mail: InternalEmailData = {
            from: emailObjectToString(data.from), // sender address
            bcc: emailObjectsToString(bccRecipients),
            replyTo: data.replyTo ? emailObjectToString(data.replyTo) : undefined,
            to,
            subject: data.subject.substring(0, 1000), // Subject line
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
                    unorderedListItemPrefix: ' - ',
                });
            }
        }

        if (!DataValidator.isEmailValid(data.from.email)) {
            throw new Error('Invalid from email ' + data.from.email);
        }

        try {
            // Can we send from the transactional email server?
            if (STAMHOOFD.TRANSACTIONAL_WHITELIST !== undefined && data.type === 'transactional') {
                if (!this.matchWhitelist(data.from.email, STAMHOOFD.TRANSACTIONAL_WHITELIST)) {
                    // Not supported
                    data.type = 'broadcast';
                }
            }

            const transporter = (data.type === 'transactional') ? this.transactionalTransporter : this.transporter;

            if (data.type === 'transactional') {
                mail.headers = {
                    ...data.headers,
                    ...STAMHOOFD.TRANSACTIONAL_SMTP_HEADERS,
                };
            }
            else {
                mail.headers = {
                    ...data.headers,
                    ...STAMHOOFD.SMTP_HEADERS,
                };
            }

            console.log('Sending email', to, data.subject, data.type);
            const info = await transporter.sendMail(mail);
            console.log('Message sent:', to, data.subject, info.messageId, data.type);

            if (STAMHOOFD.environment === 'development') {
                await sleep(100);
            }

            try {
                data.callback?.(null);
            }
            catch (e) {
                console.error('Error in email callback', e);
            }
        }
        catch (e) {
            if (STAMHOOFD.environment !== 'test') {
                console.error('Failed to send e-mail:');
                console.error(e);
                console.error(mail);

                // Sleep 1 second to give servers some time to fix possible rate limits
                await sleep(1000);
            }

            // Reschedule twice (at maximum) to fix temporary connection issues
            data.retryCount = (data.retryCount ?? 0) + 1;

            if (data.retryCount <= 2) {
                if (data.type === 'transactional' && data.retryCount === 2) {
                    data.type = 'broadcast';
                }
                this.send(data);
            }
            else {
                try {
                    if (data.callback) {
                        data.callback(e);
                    }
                }
                catch (e2) {
                    console.error('Error in email failure callback', e2, 'for original error', e);
                }

                // Email address is not verified.
                if (STAMHOOFD.environment === 'production') {
                    if (data.from.email !== this.getWebmasterFromEmail().email) {
                        this.sendWebmaster({
                            subject: $t(`2206e5e4-2fc4-4ffd-aefb-60ba0d20aa23`),
                            text: $t(`d1b217e5-c82e-42fb-93e5-dd6f2d137692`, { email: data.from.email, to: mail.to }) + ': \n\n' + e + '\n\n' + (mail.text ?? ''),
                            type: (data.type === 'transactional') ? 'broadcast' : 'transactional',
                        });
                    }
                }
            }
        }
    }

    getWebmasterFromEmail() {
        return {
            name: Formatter.capitalizeFirstLetter(STAMHOOFD.platformName ?? 'Stamhoofd'),
            email: 'webmaster@' + (new I18n(Language.Dutch, Country.Belgium).localizedDomains.defaultTransactionalEmail()),
        };
    }

    getWebmasterToEmail() {
        return {
            name: 'Stamhoofd',
            email: 'hallo@stamhoofd.be',
        };
    }

    /**
     * Send an email to the webmaster
     */
    sendWebmaster(data: Omit<EmailInterfaceBase, 'to'>) {
        const mail = Object.assign(data, {
            from: this.getWebmasterFromEmail(),
            to: [this.getWebmasterToEmail()],
            type: data.type ?? 'transactional',
        });
        this.send(mail);
    }

    send(data: EmailInterface) {
        let didSend = false;

        this.schedule(() => {
            if (didSend) {
                return undefined;
            }
            didSend = true;
            return data;
        });
    }

    schedule(builder: EmailBuilder) {
        this.currentQueue.push(builder);
        this.sendNextIfNeeded();
    }

    wait() {
        return new Promise<void>((resolve) => {
            this.schedule(() => {
                resolve();
                return undefined;
            });
        });
    }
}

export const Email = new EmailStatic();
