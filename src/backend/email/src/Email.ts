import nodemailer from "nodemailer"
import Mail from 'nodemailer/lib/mailer';


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

    async send(to: string, subject: string, text: string, html?: string) {
        if (process.env.NODE_ENV === 'test') {
            // Do not send any emails
            return;
        }

        if (process.env.NODE_ENV === "production") {
            throw new Error("Trying to send real emails. Disabled to test if detection is working correctly.")
        }

        this.setupIfNeeded();

        // send mail with defined transport object
        const mail: any = {
            from: '"Stamhoofd" <info@stamhoofd.be>', // sender address
            to: process.env.NODE_ENV === "production" ? to : "info@stamhoofd.be",
            subject: subject, // Subject line
            text: text // plain text body
        };
        if (html) {
            mail.html = html;
        }
        const info = await this.transporter.sendMail(mail);
        console.log("Message sent: %s", info.messageId);
    }
}

export default new Email();