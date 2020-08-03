import { String } from 'aws-sdk/clients/cloudhsm';
import nodemailer from "nodemailer"
import Mail from 'nodemailer/lib/mailer';
const htmlToText = require('html-to-text');

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export type EmailInterfaceBase = {
    to: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string; contentType?: string }[];
}

export type EmailInterface = EmailInterfaceBase & {
    from: string;
}

/// An email builder is called until it returns undefined. This allows to reduce memory usage for an e-mail with multiple recipients
export type EmailBuilder = () => EmailInterface | undefined

class Email {
    transporter: Mail;
    rps = 14

    currentQueue: EmailBuilder[] = []
    sending = false

    setupIfNeeded() {
        if (this.transporter) {
            return;
        }
        if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
            throw new Error("Missing environment variables to send emails");
            return;
        }

        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({
            pool: true,
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            auth: {
                user: process.env.SMTP_USERNAME, // generated ethereal user
                pass: process.env.SMTP_PASSWORD // generated ethereal password
            }
        });

        // verify connection configuration
        this.transporter.verify((error) => {
            if (error) {
                console.error("SMTP server not working", error);
            } else {
                console.log("Server is ready to take our messages");
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
            this.doSend(next).finally(() => {
                this.sending = false
                this.sendNextIfNeeded()
            })
        }
    }

    private async doSend(data: EmailInterface) {
        if (process.env.NODE_ENV === 'test') {
            // Do not send any emails
            return;
        }

        this.setupIfNeeded();

        // send mail with defined transport object
        const mail: any = {
            from: data.from, // sender address
            replyTo: data.replyTo,
            to: process.env.NODE_ENV === "production" ? data.to : "simon@stamhoofd.be",
            subject: data.subject, // Subject line
            text: data.text ?? "" // plain text body
        };

        if (data.attachments) {
            mail.attachments = data.attachments;
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

        const info = await this.transporter.sendMail(mail);
        console.log("Message sent: %s", info.messageId);
    }

    /**
     * Send an internal e-mail (from stamhoofd)
     */
    sendInternal(data: EmailInterfaceBase) {
        const mail = Object.assign({ from: '"Simon van Stamhoofd" <simon@stamhoofd.be>', data})
        this.send(mail)
    }

    send(data: EmailInterface) {
        if (process.env.NODE_ENV === 'test') {
            // Do not send any emails
            return;
        }
        let didSend = false

        this.schedule(() => {
            if (didSend) {
                return
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

export default new Email();