import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, EmailAddress, EmailBuilder } from '@stamhoofd/email';
import { PasswordToken } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { EmailRequest, Recipient, Replacement } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = EmailRequest
type ResponseBody = undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class EmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EmailRequest as Decoder<EmailRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);

        if (request.body.recipients.length > 10000) {
            throw new SimpleError({
                code: "too_many_recipients",
                message: "Too many recipients",
                human: "Je kan maar een mail naar maximaal 10000 personen tergelijk versturen. Contacteer ons om deze limiet te verhogen indien dit nodig is.",
                field: "recipients"
            })
        }
        const emails = [
            {
                email: "hallo@stamhoofd.be",
                name: "Stamhoofd"
            },
            {
                email: "simon@stamhoofd.be",
                name: "Simon Backx"
            },
            {
                email: "hallo@stamhoofd.nl",
                name: "Stamhoofd"
            },
            {
                email: "simon@stamhoofd.nl",
                name: "Simon Backx"
            }
        ]

        // Validate email
        const sender = emails.find(e => e.email == request.body.emailId)
        if (!sender) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid emailId",
                human: "Het e-mailadres waarvan je wilt versturen bestaat niet (meer). Kijk je het na?",
                field: "emailId"
            })
        }

        // Validate attachments
        const size = request.body.attachments.reduce((value: number, attachment) => {
            return value + attachment.content.length
        }, 0)
        
        if (size > 9.5*1024*1024) {
            throw new SimpleError({
                code: "too_big_attachments",
                message: "Too big attachments",
                human: "Jouw bericht is te groot. Grote bijlages verstuur je beter niet via e-mail, je plaatst dan best een link naar de locatie in bv. Google Drive. De maximale grootte van een e-mail is 10MB, inclusief het bericht. Als je grote bestanden verstuurt kan je ze ook proberen te verkleinen.",
                field: "attachments"
            })
        }

        const safeContentTypes = [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/gif"
        ]

        for (const attachment of request.body.attachments) {
            if (attachment.contentType && !safeContentTypes.includes(attachment.contentType)) {
                throw new SimpleError({
                    code: "content_type_not_supported",
                    message: "Content-Type not supported",
                    human: "Het bestandstype van jouw bijlage wordt niet ondersteund of is onveilig om in een e-mail te plaatsen. Overweeg om je bestand op bv. Google Drive te zetten en de link in jouw e-mail te zetten.",
                    field: "attachments"
                })
            }
        }

        const attachments = request.body.attachments.map((attachment, index) => {
            let filename = "bijlage-"+index;
            
            if (attachment.contentType == "application/pdf") {
                // tmp solution for pdf only
                filename += ".pdf"
            }

            // Correct file name if needed
            if (attachment.filename) {
                filename = attachment.filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
            }

            return {
                filename: filename,
                content: attachment.content,
                contentType: attachment.contentType ?? undefined,
                encoding: "base64"
            }
        })

        let from = sender.email

        // Include name in form field
        if (sender.name) {
            from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }

        const email = request.body

        // Update recipients
        const cleaned: Recipient[] = []
        for (const recipient of email.recipients) {
            const unsubscribe = await EmailAddress.getOrCreate(recipient.email, null)

            if (unsubscribe.unsubscribedMarketing || unsubscribe.unsubscribedAll || unsubscribe.hardBounce || unsubscribe.markedAsSpam || !unsubscribe.token) {
                // Ignore
                continue
            }
            recipient.replacements.push(Replacement.create({
                token: "unsubscribeUrl",
                value: "https://"+STAMHOOFD.domains.dashboard+"/unsubscribe?id="+encodeURIComponent(unsubscribe.id)+"&token="+encodeURIComponent(unsubscribe.token)+"&type=marketing"
            }))

            // Override headers
            recipient.headers = {
                'List-Unsubscribe': "<mailto:unsubscribe+"+unsubscribe.id+"@stamhoofd.email>",
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
            cleaned.push(recipient)
        }
        email.recipients = cleaned

        // Create e-mail builder
        const builder: EmailBuilder = () => {
            const recipient = email.recipients.shift()
            if (!recipient) {
                return undefined
            }

            let html = email.html
            let subject = email.subject

            for (const replacement of recipient.replacements) {
                if (html) {
                    html = html.replaceAll("{{"+replacement.token+"}}", Formatter.escapeHtml(replacement.value))
                }
                subject = subject.replaceAll("{{"+replacement.token+"}}", replacement.value)
            }

            let to = recipient.email

            if (recipient.firstName && recipient.lastName) {
                to = '"'+(recipient.firstName+" "+recipient.lastName).replaceAll("\"", "\\\"")+"\" <"+to+">" 
            } else if (recipient.firstName) {
                to = '"'+recipient.firstName.replaceAll("\"", "\\\"")+"\" <"+to+">" 
            }

            return {
                from,
                to,
                subject,
                type: 'transactional',
                text: email.text ?? undefined,
                html: html ?? undefined,
                attachments
            }
        }
        Email.schedule(builder)

        return new Response(undefined);
    }
}
