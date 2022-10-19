import { EmailAddress, EmailBuilder } from "@stamhoofd/email";
import { Recipient, Replacement } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Organization, PasswordToken, User } from "../models";

export async function getEmailBuilder(organization: Organization, email: {
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
    }[]
}) {
    // Update recipients
    const cleaned: Recipient[] = []
    for (const recipient of email.recipients) {
        try {
            const unsubscribe = await EmailAddress.getOrCreate(recipient.email, organization.id)

            if (unsubscribe.unsubscribedAll || unsubscribe.hardBounce || unsubscribe.markedAsSpam || !unsubscribe.token) {
                // Ignore
                continue
            }
            recipient.replacements.push(Replacement.create({
                token: "unsubscribeUrl",
                value: "https://"+STAMHOOFD.domains.dashboard+"/"+organization.i18n.locale+"/unsubscribe?id="+encodeURIComponent(unsubscribe.id)+"&token="+encodeURIComponent(unsubscribe.token)+"&type=all"
            }))
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

        const extra = organization.meta.getEmailReplacements()
        recipient.replacements.push(...extra)
    }

    const queue = email.recipients.slice()

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

        let to = recipient.email

        if (recipient.firstName && recipient.lastName) {
            to = '"'+(recipient.firstName+" "+recipient.lastName).replace("\"", "\\\"")+"\" <"+to+">" 
        } else if (recipient.firstName) {
            to = '"'+recipient.firstName.replace("\"", "\\\"")+"\" <"+to+">" 
        }

        return {
            from: email.from,
            replyTo: email.replyTo,
            to,
            subject: replacedSubject,
            html: replacedHtml ?? undefined,
            attachments: email.attachments
        }
    }
    return builder;
}