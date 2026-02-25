/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Email, EmailAddress, EmailInterface, EmailInterfaceRecipient } from '@stamhoofd/email';
import { Organization, Platform } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { simpleParser } from 'mailparser';

export class ForwardHandler {
    static async handle(content: any, receipt: {
        recipients: string[];
        spamVerdict: { status: 'PASS' | string };
        virusVerdict: { status: 'PASS' | string };
        spfVerdict: { status: 'PASS' | string };
        dkimVerdict: { status: 'PASS' | string };
        dmarcVerdict: { status: 'PASS' | string };
    },
    ) {
        const recipients = receipt.recipients;
        const email: string | undefined = recipients[0];
        const organization: Organization | undefined = email ? await Organization.getByEmail(email) : undefined;

        const parsed = await simpleParser(content);
        const from = parsed.from?.value[0]?.address;

        if (from && from.endsWith('amazonses.com') && organization) {
            console.log('Bounce e-mails from AWS SES for organizations are not forwarded. Received from ' + from + ', to ' + email);
            return;
        }

        // Unsubscribe email?
        for (const domain of Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {})) {
            if (email && email?.startsWith('unsubscribe+') && email.endsWith('@' + domain)) {
                // Get id
                const id = email.substring('unsubscribe+'.length, email.indexOf('@' + domain));
                const model = await EmailAddress.getByID(id);

                if (model) {
                    console.log('[Unsubscribe] Received an unsubscribe request for ' + model.email + ' from ' + from);
                    if (model.unsubscribedAll) {
                        // Ignore
                        return;
                    }
                    model.unsubscribedAll = true;
                    await model.save();
                }
                else {
                    console.error('[Unsubscribe] Received an unsubscribe request for unknown ID ' + id + ' from ' + from);

                    // Forward
                    return {
                        from: Email.getWebmasterFromEmail(),
                        to: [Email.getWebmasterToEmail()],
                        subject: 'E-mail unsubscribe mislukt',
                        text: 'Beste,\n\nEr werd een unsubscribe gemeld op ' + email + ' die niet kon worden verwerkt. Gelieve dit na te kijken.\n\nStamhoofd',
                    };
                }
                return;
            }
        }

        if (receipt.spamVerdict.status !== 'PASS' || receipt.virusVerdict.status !== 'PASS' || !(receipt.spfVerdict.status == 'PASS' || receipt.dkimVerdict.status == 'PASS')) {
            console.error('Received spam or virus e-mail. Ignoring', 'to', recipients, 'from', email, 'subject', parsed.subject);
            return;
        }

        // Send a new e-mail
        let defaultEmail: EmailInterfaceRecipient[] = [Email.getWebmasterToEmail()];
        let organizationEmails: EmailInterfaceRecipient[] = [];
        const platform = await Platform.getShared();
        const extraDescription = $t(`24bc9aad-bc92-4d27-bfcd-055113d792fa`) + ' ' + email + $t(`97b9b042-c5b6-42dc-8238-e0e8392fcf26`) + ' ' + platform.config.name + ' ' + $t(`f510fb0c-c180-455a-8f23-7e09e344e47a`);

        function doBounce() {
            if (!from) {
                return;
            }

            if (from.endsWith('@amazonses.com')) {
                // Ignore
                return;
            }

            // Send back to receiver without including the original message to avoid spam
            return {
                from: email
                    ? {
                            email,
                        }
                    : Email.getWebmasterToEmail(),
                to: [{ email: from }],
                subject: 'Ongeldig e-mailadres',
                text: 'Beste,\n\nDe vereniging die je probeert te bereiken via ' + email + ' is helaas niet bereikbaar via dit e-mailadres. Dit e-mailadres wordt enkel gebruikt voor het versturen van automatische e-mails in naam van een vereniging. Probeer de vereniging te contacteren via een ander e-mailadres.\n\nBedankt.',
            };
        }

        if (organization) {
            organizationEmails = await organization.getReplyEmails();
            if (!organizationEmails) {
                if (STAMHOOFD.environment === 'test') {
                    // ignore
                }
                else {
                    console.error('Missing reply emails for organization ' + organization.id);
                }
                return doBounce();
            }
            else {
                defaultEmail = organizationEmails;
            }
        }
        else {
            return doBounce();
        }

        console.log('Forward to', defaultEmail);

        let html: string | undefined = undefined;

        if (parsed.html !== false) {
            // Search for body
            const body = parsed.html.toLowerCase().indexOf('<body');

            if (body !== -1) {
                const endTag = parsed.html.indexOf('>', body);
                html = parsed.html.substring(0, endTag + 1) + '<p><i>' + Formatter.escapeHtml(extraDescription) + '<br><br></i></p>' + parsed.html.substring(endTag + 1);
            }
            else {
                html = '<p><i>' + Formatter.escapeHtml(extraDescription) + '<br><br></i></p>' + parsed.html;
            }
        }

        const options: EmailInterface = {
            from: email
                ? {
                        email,
                    }
                : Email.getWebmasterToEmail(),
            to: defaultEmail,
            replyTo: parsed.from?.text
                ? {
                        email: parsed.from?.text,
                    }
                : undefined,
            subject: parsed.subject ?? 'Doorgestuurd bericht',
            text: parsed.text ? extraDescription + '\n\n' + parsed.text : undefined,
            html: html,
            attachments: parsed.attachments.flatMap((a) => {
                if (a.cid) {
                    // Already done inline in html
                    return [];
                }
                return [{
                    filename: a.filename ?? '',
                    content: a.content.toString('utf-8'),
                    contentType: a.contentType,
                }];
            }),
        };

        return options;
    }
}
