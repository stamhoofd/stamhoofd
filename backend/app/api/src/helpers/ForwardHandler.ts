import { Organization } from "@stamhoofd/models";
import { Formatter } from "@stamhoofd/utility";
import { simpleParser } from "mailparser";

export class ForwardHandler {
    static async handle(content: any, receipt: {
            recipients: string[];
            spamVerdict: { status: 'PASS' | string };
            virusVerdict: { status: 'PASS' | string };
            spfVerdict: { status: 'PASS' | string };
            dkimVerdict: { status: 'PASS' | string };
            dmarcVerdict: { status: 'PASS' | string };
        }
    ) {
        if (receipt.spamVerdict.status != "PASS" || receipt.virusVerdict.status != "PASS" || !(receipt.spfVerdict.status == "PASS" || receipt.dkimVerdict.status == "PASS")) {
            console.error("Received spam or virus e-mail. Ignoring")
            return;
        }

        const recipients = receipt.recipients
        const email: string | undefined = recipients[0]
        const organization: Organization | undefined = email ? await Organization.getByEmail(email) : undefined

        const parsed = await simpleParser(content);
        const from = parsed.from?.value[0]?.address

        if (from && from.endsWith("amazonses.com") && organization) {
            console.log("Bounce e-mails from AWS SES for organizations are not forwarded. Received from "+from+", to "+email)
            return;
        }

        // Send a new e-mail
        let defaultEmail = "hallo@stamhoofd.be"
        let organizationEmails: { emails: string; private: boolean } | undefined
        if (organization) {
            organizationEmails = await organization.getReplyEmails()
            if (!organizationEmails) {
                if (STAMHOOFD.environment === "test") {
                    // ignore
                } else {
                    console.error("Missing reply emails for organization "+organization.id)
                    // Still send to default
                }
            } else {
                defaultEmail = organizationEmails.emails
            }
        }

        console.log("Forward to "+defaultEmail)       
        
        let extraDescription = "Dit bericht werd verstuurd naar "+email+", en werd automatisch doorgestuurd. Normaal antwoorden gebruikers rechtstreeks naar het juiste e-mailadres maar enkele e-mail programma's ondersteunen deze standaard functionaliteit niet en sturen antwoorden altijd naar de verstuurder (en wij kunnen niet versturen vanaf jouw e-mailadres, tenzij je jouw domeinnaam instelt in Stamhoofd). Let op dat je zelf ook naar het juiste e-mailadres antwoordt ("+(from ?? "?")+").";
        if (organization && organizationEmails && organizationEmails.private) {
            extraDescription = "Dit bericht werd verstuurd naar "+email+", en werd automatisch doorgestuurd naar alle beheerders. Stel in Stamhoofd de e-mailadressen in om ervoor te zorgen dat antwoorden naar een specifiek e-mailadres worden verstuurd."
        }

        let html: string | undefined = undefined

        if (parsed.html !== false) {
            // Search for body
            const body = parsed.html.toLowerCase().indexOf("<body")

            if (body != -1) {
                const endTag = parsed.html.indexOf(">", body)
                html = parsed.html.substring(0, endTag + 1) + "<p><i>"+Formatter.escapeHtml(extraDescription)+"<br><br></i></p>"+parsed.html.substring(endTag + 1)
            } else {
                html = "<p><i>"+Formatter.escapeHtml(extraDescription)+"<br><br></i></p>"+parsed.html
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

        return options
    }
}