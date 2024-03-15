import { EmailAddress, EmailBuilder } from "@stamhoofd/email";
import { Recipient, Replacement } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { Organization, PasswordToken, User } from "../models";

export async function getEmailBuilder(organization: Organization, email: {
    defaultReplacements?: Replacement[],
    recipients: Recipient[], 
    from: string, 
    replyTo?: string, 
    subject: string, 
    //text: string | null, 
    html: string | null,
    attachments?: {
        filename: string;
        content: string;
        contentType: string | undefined;
        encoding: string;
    }[],
    type?: "transactional" | "broadcast",
    unsubscribeType?: 'all'|'marketing',
    fromStamhoofd?: boolean,
    singleBcc?: string
}) {
    // Update recipients
    const cleaned: Recipient[] = []
    for (const recipient of email.recipients) {
        try {
            const unsubscribe = await EmailAddress.getOrCreate(recipient.email, email.fromStamhoofd ? null : organization.id)

            if (unsubscribe.unsubscribedAll || unsubscribe.hardBounce || unsubscribe.markedAsSpam || !unsubscribe.token || (unsubscribe.unsubscribedMarketing && email.unsubscribeType === 'marketing')) {
                // Ignore
                continue
            }
            recipient.replacements.push(Replacement.create({
                token: "unsubscribeUrl",
                value: "https://"+STAMHOOFD.domains.dashboard+"/"+organization.i18n.locale+"/unsubscribe?id="+encodeURIComponent(unsubscribe.id)+"&token="+encodeURIComponent(unsubscribe.token)+"&type="+encodeURIComponent(email.unsubscribeType ?? 'all')
            }))

            // Override headers
            recipient.headers = {
                'List-Unsubscribe': "<mailto:unsubscribe+"+unsubscribe.id+"@stamhoofd.email>",
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
            cleaned.push(recipient)
        } catch (e) {
            console.error(e)
        }
    }
    email.recipients = cleaned

    // Update recipients
    for (const recipient of email.recipients) {
        recipient.replacements = recipient.replacements.slice()

        // Default signInUrl
        let signInUrl = "https://"+organization.getHost()+"/login?email="+encodeURIComponent(recipient.email)

        if (recipient.userId) {
            const recipientUser = await User.getByID(recipient.userId)
            if (recipientUser && recipientUser.organizationId === organization.id && recipientUser.email === recipient.email) {
                // We can create a special token
                signInUrl = await PasswordToken.getMagicSignInUrl(recipientUser.setRelation(User.organization, organization))
            }
        }

        recipient.replacements.push(Replacement.create({
            token: "signInUrl",
            value: signInUrl
        }))

        if (email.defaultReplacements) {
            recipient.replacements.push(...email.defaultReplacements)
        }

        const extra = organization.meta.getEmailReplacements()
        recipient.replacements.push(...extra)
    }

    const queue = email.recipients.slice()

    let emailIndex = 0;

    // Create e-mail builder
    const builder: EmailBuilder = () => {
        const recipient = queue.shift()
        if (!recipient) {
            return undefined
        }

        let replacedHtml = email.html
        let replacedSubject = email.subject
        //let replacedText = email.text

        for (const replacement of recipient.replacements) {
            if (replacedHtml) {
                replacedHtml = replacedHtml.replaceAll("{{"+replacement.token+"}}", replacement.html ?? Formatter.escapeHtml(replacement.value))
            }
            //if (replacedText) {
            //    replacedText = replacedText.replaceAll("{{"+replacement.token+"}}", replacement.value)
            //}
            replacedSubject = replacedSubject.replaceAll("{{"+replacement.token+"}}", replacement.value)
        }

        emailIndex += 1;

        return {
            from: email.from,
            replyTo: email.replyTo,
            bcc: emailIndex === 1 ? email.singleBcc : undefined,
            to: [
                {
                    // Name will get cleaned by email service
                    name: (recipient.firstName??'')+" "+(recipient.lastName??''),
                    email: recipient.email
                }
            ],
            subject: replacedSubject,
            html: replacedHtml ?? undefined,
            attachments: email.attachments,
            headers: recipient.headers,
            type: email.type
        }
    }
    return builder;
}