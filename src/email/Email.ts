import nodemailer from "nodemailer"
import Mail from 'nodemailer/lib/mailer';
const htmlToText = require('html-to-text');

class Email {
    transporter: Mail;

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

    async send(to: string, subject: string, text: string | undefined, html?: string, attachments?: { filename: string; path?: string; content?: string }[]) {
        if (process.env.NODE_ENV === 'test') {
            // Do not send any emails
            return;
        }

        this.setupIfNeeded();

        // send mail with defined transport object
        const mail: any = {
            from: '"Simon van Stamhoofd" <simon@stamhoofd.be>', // sender address
            to: process.env.NODE_ENV === "production" ? to : "hi@simonbackx.com",
            subject: subject, // Subject line
            text: text ?? "" // plain text body
        };

        if (attachments) {
            mail.attachments = attachments;
        }
        if (html) {
            mail.html = html;

            if (!text) {
                mail.text = htmlToText.fromString(html, {
                    wordwrap: null,
                    unorderedListItemPrefix: " - "
                });
            }
        }
        const info = await this.transporter.sendMail(mail);
        console.log("Message sent: %s", info.messageId);
    }
}

export default new Email();