import { ArrayDecoder,AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailRequest, Organization as OrganizationStruct, OrganizationPatch } from "@stamhoofd/structures";

import Email, { EmailBuilder } from '../email/Email';
import { Token } from '../models/Token';

type Params = {};
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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasReadAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        if (request.body.recipients.length > 1000) {
            throw new SimpleError({
                code: "too_many_recipients",
                message: "Too many recipients",
                human: "Je kan maar een mail naar maximaal 1000 personen tergelijk versturen. Contacteer ons om deze limiet te verhogen indien dit nodig is.",
                field: "recipients"
            })
        }

        // Validate email
        const sender = user.organization.privateMeta.emails.find(e => e.id == request.body.emailId)
        if (!sender) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid emailId",
                human: "Het e-mailadres waarvan je wilt versturen bestaat niet (meer). Kijk je het na?",
                field: "emailId"
            })
        }

        let from = "inschrijvingen@stamhoofd.be"

        // Can we send from this e-mail or reply-to?
        if (user.organization.privateMeta.mailDomain && user.organization.privateMeta.mailDomainActive && sender.email.endsWith("@"+user.organization.privateMeta.mailDomain)) {
            from = sender.email
        }

        const email = request.body

        // Create e-mail builder
        const builder: EmailBuilder = () => {
            const recipient = email.recipients.shift()
            if (!recipient) {
                return undefined
            }

            // Replacements (todo)

            return {
                from,
                to: recipient.email,
                subject: email.subject,
                text: email.text ?? undefined,
                html: email.html ?? undefined
            }
        }

        Email.schedule(builder)
        return new Response(undefined);
    }
}
