import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Email } from '@stamhoofd/email';
import { getEmailBuilder,RateLimiter } from '@stamhoofd/models';
import { EmailRequest, Recipient } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = EmailRequest
type ResponseBody = undefined;

export const paidEmailRateLimiter = new RateLimiter({
    limits: [
        {   
            // Max 5.000 emails a day
            limit: 5000,
            duration: 24 * 60 * 1000 * 60
        },
        {   
            // 10.000 requests per week
            limit: 10000,
            duration: 24 * 60 * 1000 * 60 * 7
        }
    ]
});

export const freeEmailRateLimiter = new RateLimiter({
    limits: [
        {   
            // Max 100 a day
            limit: 100,
            duration: 24 * 60 * 1000 * 60
        },
        {   
            // Max 200 a week
            limit: 200,
            duration: 7 * 24 * 60 * 1000 * 60
        }
    ]
});

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
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        if (!Context.auth.canSendEmails()) {
            throw Context.auth.error()
        }  

        if (request.body.recipients.length > 5000) {
            throw new SimpleError({
                code: "too_many_recipients",
                message: "Too many recipients",
                human: "Je kan maar een mail naar maximaal 5000 personen tergelijk versturen. Contacteer ons om deze limiet te verhogen indien dit nodig is.",
                field: "recipients"
            })
        }

        // For non paid organizations, the limit is 10
        if (request.body.recipients.length > 10 && !organization.meta.packages.isPaid) {
            throw new SimpleError({
                code: "too_many_emails",
                message: "Too many e-mails",
                human: "Zolang je de demo versie van Stamhoofd gebruikt kan je maar maximaal een email sturen naar 10 emailadressen. Als je het pakket aankoopt zal deze limiet er niet zijn. Dit is om misbruik te voorkomen met spammers die spam email versturen via Stamhoofd.",
                field: "recipients"
            })
        }

        const limiter = organization.meta.packages.isPaid ? paidEmailRateLimiter : freeEmailRateLimiter

        try {
            limiter.track(organization.id, request.body.recipients.length);
        } catch (e) {
            Email.sendInternal({
                to: "hallo@stamhoofd.be",
                subject: "[Limiet] Limiet bereikt voor aantal e-mails",
                text: "Beste, \nDe limiet werd bereikt voor het aantal e-mails per dag. \nVereniging: "+organization.id+" ("+organization.name+")" + "\n\n" + e.message + "\n\nStamhoofd"
            }, new I18n("nl", "BE"))

            throw new SimpleError({
                code: "too_many_emails_period",
                message: "Too many e-mails limited",
                human: "Oeps! Om spam te voorkomen limiteren we het aantal emails die je per dag/week kan versturen. Neem contact met ons op om deze limiet te verhogen.",
                field: "recipients"
            })
        }
       

        // Validate email
        const sender = organization.privateMeta.emails.find(e => e.id == request.body.emailId)
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

        let from = organization.uri+"@stamhoofd.email";
        let replyTo: string | undefined = sender.email;

        // Can we send from this e-mail or reply-to?
        if (organization.privateMeta.mailDomain && organization.privateMeta.mailDomainActive && sender.email.endsWith("@"+organization.privateMeta.mailDomain)) {
            from = sender.email
            replyTo = undefined;
        }

        // Include name in form field
        if (sender.name) {
            from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        } else {
            from = '"'+organization.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }

        const email = request.body

        // Create e-mail builder
        const builder = await getEmailBuilder(organization, {
            ...email,
            from,
            replyTo,
            attachments,
            defaultReplacements: request.body.defaultReplacements ?? []
        })

        Email.schedule(builder)

        // Also send a copy
        const recipient = Recipient.create(email.recipients[0])
        recipient.email = sender.email
        recipient.firstName = sender.name ?? null
        recipient.lastName = null
        recipient.userId = null
        
        const prefix = "<p><i>Kopie e-mail verzonden door "+user.firstName+" "+user.lastName+"</i><br /><br /></p>"
        const builder2 = await getEmailBuilder(organization, {
            ...email,
            subject: "[KOPIE] "+email.subject,
            html: email.html?.replace("<body>", "<body>"+prefix) ?? null,
            recipients: [
                recipient
            ],
            from,
            replyTo,
            attachments
        })

        Email.schedule(builder2)

        return new Response(undefined);
    }
}
