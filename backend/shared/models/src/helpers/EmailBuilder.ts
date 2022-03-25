import { EmailBuilder } from "@stamhoofd/email";
import { Recipient, Replacement } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Organization } from "../models/Organization";
import { PasswordToken } from "../models/PasswordToken";
import { User } from "../models/User";

export async function getEmailBuilder(organization: Organization, email: {
    recipients: Recipient[], 
    from: string, 
    replyTo?: string, 
    subject: string, 
    text: string | null, 
    html: string | null,
    attachments?: {
        filename: string;
        content: string;
        contentType: string | undefined;
        encoding: string;
    }[]
}) {
    // Update recipients
    for (const recipient of email.recipients) {
        
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
        let replacedText = email.text

        for (const replacement of recipient.replacements) {
            if (replacedHtml) {
                replacedHtml = replacedHtml.replaceAll("{{"+replacement.token+"}}", replacement.html ?? Formatter.escapeHtml(replacement.value))
            }
            if (replacedText) {
                replacedText = replacedText.replaceAll("{{"+replacement.token+"}}", replacement.value)
            }
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
            text: replacedText ?? undefined,
            html: replacedHtml ?? undefined,
            attachments: email.attachments
        }
    }
    return builder;
}