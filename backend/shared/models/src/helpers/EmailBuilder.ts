import { Email, EmailAddress, EmailBuilder } from '@stamhoofd/email';
import { BalanceItem as BalanceItemStruct, EmailTemplateType, OrganizationEmail, Platform as PlatformStruct, ReceivableBalanceType, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { CachedBalance, EmailTemplate, Group, Organization, Platform, User, Webshop } from '../models';

export type EmailTemplateOptions = {
    type: EmailTemplateType;
    webshop?: Webshop | null;
    group?: Group | null;
    organizationId?: string | null;
};

export async function getEmailTemplate(data: EmailTemplateOptions) {
    // Most specific template: for specific group
    const q = EmailTemplate.select()
        .where('type', data.type);

    if (data.group) {
        q.where('groupId', data.group.id);
    }

    if (data.organizationId) {
        q.where('organizationId', data.organizationId);
    }

    if (data.webshop) {
        q.where('webshopId', data.webshop.id);
    }

    let templates = await q.limit(1).fetch();

    // Specific for organization
    if (templates.length == 0 && (data.group?.id || data.webshop?.id) && data.organizationId) {
        templates = await EmailTemplate.select()
            .where('type', data.type)
            .where('organizationId', data.organizationId)
            .where('groupId', null)
            .where('webshopId', null)
            .limit(1)
            .fetch();
    }

    // Default for platform
    if (templates.length == 0 && (data.group?.id || data.webshop?.id || data.organizationId)) {
        templates = await EmailTemplate.select()
            .where('type', data.type)
            .where('organizationId', null)
            .where('groupId', null)
            .where('webshopId', null)
            .limit(1)
            .fetch();
    }

    if (templates.length == 0) {
        if (STAMHOOFD.environment === 'test') {
            return;
        }
        console.error('Could not find email template for type ' + data.type);
        return;
    }

    return templates[0];
}

export async function canSendFromEmail(fromAddress: string, organization: Organization | null) {
    if (organization) {
        if (organization.privateMeta.mailDomain && organization.privateMeta.mailDomainActive && fromAddress.endsWith('@' + organization.privateMeta.mailDomain)) {
            return true;
        }

        if (organization.id === (await Platform.getSharedPrivateStruct()).membershipOrganizationId) {
            return canSendFromEmail(fromAddress, null);
        }

        return false;
    }
    const transactionalDomains = Object.values(STAMHOOFD.domains.defaultTransactionalEmail ?? {});
    const broadcastDomains = Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {});
    const domains = Formatter.uniqueArray([...transactionalDomains, ...broadcastDomains]);

    for (const domain of domains) {
        if (fromAddress.endsWith('@' + domain)) {
            return true;
        }
    }

    return false;
}

export async function getDefaultEmailFrom(organization: Organization | null, options: Pick<EmailBuilderOptions, 'type'> & { template: Omit<EmailTemplateOptions, 'organizationId' | 'type'> }) {
    // When choosing sending domain, prefer using the one with the highest reputation
    let preferEmailId: string | null = null;

    if (options.template.group) {
        preferEmailId = options.template.group.privateSettings.defaultEmailId;
    }

    if (options.template.webshop) {
        preferEmailId = options.template.webshop.privateMeta.defaultEmailId;
    }

    if (organization) {
        // Default email address for the chosen email type
        let from = organization.getDefaultFrom(organization.i18n, false, options.type ?? 'broadcast');

        const sender: OrganizationEmail | undefined = (preferEmailId ? organization.privateMeta.emails.find(e => e.id === preferEmailId) : null) ?? organization.privateMeta.emails.find(e => e.default) ?? organization.privateMeta.emails[0];
        let replyTo: string | undefined = undefined;

        if (sender) {
            replyTo = sender.email;

            // Can we send from this e-mail or reply-to?
            if (await canSendFromEmail(sender.email, organization)) {
                from = sender.email;
                replyTo = undefined;
            }

            // Include name in form field
            if (sender.name) {
                from = '"' + sender.name.replaceAll('"', '\\"') + '" <' + from + '>';
            }
            else {
                from = '"' + organization.name.replaceAll('"', '\\"') + '" <' + from + '>';
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"' + sender.name.replaceAll('"', '\\"') + '" <' + replyTo + '>';
                }
                else {
                    replyTo = '"' + organization.name.replaceAll('"', '\\"') + '" <' + replyTo + '>';
                }
            }
        }
        else {
            from = '"' + organization.name.replaceAll('"', '\\"') + '" <' + from + '>';
        }

        return {
            from, replyTo,
        };
    }
    const platform = await Platform.getSharedPrivateStruct();

    // Default e-mail if no email addresses are configured
    const i18n = new I18n($getLanguage(), $getCountry());
    const transactionalDomain = i18n.localizedDomains.defaultTransactionalEmail();
    const broadcastDomain = i18n.localizedDomains.defaultBroadcastEmail();

    const domain = (options.type === 'transactional' ? transactionalDomain : broadcastDomain);
    let from = 'hallo@' + domain;

    // Platform
    const sender: OrganizationEmail | undefined = (preferEmailId ? platform.privateConfig.emails.find(e => e.id === preferEmailId) : null) ?? platform.privateConfig.emails.find(e => e.default) ?? platform.privateConfig.emails[0];
    let replyTo: string | undefined = undefined;

    if (sender) {
        replyTo = sender.email;

        // Are we allowed to send an e-mail from this domain?
        if (await canSendFromEmail(sender.email, null)) {
            // Allowed to send from
            from = sender.email;
            replyTo = undefined;
        }

        // Include name in form field
        if (sender.name) {
            from = '"' + sender.name.replaceAll('"', '\\"') + '" <' + from + '>';
        }
        else {
            from = '"' + platform.config.name.replaceAll('"', '\\"') + '" <' + from + '>';
        }

        if (replyTo) {
            if (sender.name) {
                replyTo = '"' + sender.name.replaceAll('"', '\\"') + '" <' + replyTo + '>';
            }
            else {
                replyTo = '"' + platform.config.name.replaceAll('"', '\\"') + '" <' + replyTo + '>';
            }
        }
    }
    else {
        from = '"' + platform.config.name.replaceAll('"', '\\"') + '" <' + from + '>';
    }

    return {
        from, replyTo,
    };
}

export async function sendEmailTemplate(organization: Organization | null, options: Omit<EmailBuilderOptions, 'subject' | 'html' | 'from' | 'replyTo'> & { template: Omit<EmailTemplateOptions, 'organizationId'> }) {
    if (options.template.webshop) {
        options.defaultReplacements = [...(options.defaultReplacements ?? []), ...options.template.webshop.meta.getEmailReplacements()];
    }
    const builder = await getEmailBuilderForTemplate(organization, {
        ...options,
        ...(await getDefaultEmailFrom(organization, options)),
    });
    if (builder) {
        Email.schedule(builder);
    }
}

export async function getEmailBuilderForTemplate(organization: Organization | null, options: Omit<EmailBuilderOptions, 'subject' | 'html'> & { template: Omit<EmailTemplateOptions, 'organizationId'> }) {
    const template = await getEmailTemplate({
        ...options.template,
        organizationId: organization?.id ?? null,
    });

    if (!template) {
        return undefined;
    }

    return await getEmailBuilder(organization, {
        ...options,
        subject: template.subject,
        html: template.html,
    });
}

export type EmailBuilderOptions = {
    defaultReplacements?: Replacement[];
    recipients: Recipient[];
    from: string;
    replyTo?: string | null;
    subject: string;
    html: string;
    attachments?: {
        filename: string;
        content: string;
        contentType: string | undefined;
        encoding: string;
    }[];
    type?: 'transactional' | 'broadcast';
    unsubscribeType?: 'all' | 'marketing';
    fromStamhoofd?: boolean;
    singleBcc?: string;
    replaceAll?: { from: string; to: string }[]; // replace in all e-mails, not recipient dependent
    callback?: (error: Error | null) => void; // for each email
};

export function replaceHtml(html: string, replacements: Replacement[]) {
    let replacedHtml = html;

    for (const replacement of replacements) {
        replacedHtml = replacedHtml.replaceAll('{{' + replacement.token + '}}', replacement.html || Formatter.escapeHtml(replacement.value));
    }
    return replacedHtml;
}

export function replaceText(text: string, replacements: Replacement[]) {
    let replacedText = text;

    for (const replacement of replacements) {
        replacedText = replacedText.replaceAll('{{' + replacement.token + '}}', replacement.value);
    }
    return replacedText;
}

/**
 * @param organization defines replacements and unsubsribe behaviour
 */
export async function getEmailBuilder(organization: Organization | null, email: EmailBuilderOptions) {
    const platform = await Platform.getSharedPrivateStruct();
    // Update recipients
    const cleaned: Recipient[] = [];
    for (const recipient of email.recipients) {
        try {
            const unsubscribeGlobal = await EmailAddress.getWhereHardBounceOrSpam(recipient.email);
            if ((unsubscribeGlobal && (unsubscribeGlobal.hardBounce))) {
                // Ignore
                if (email.callback) {
                    email.callback(
                        new SimpleError({
                            code: 'email_hard_bounce',
                            message: 'Recipient has hard bounced',
                            human: 'Dit e-mailadres is waarschijnlijk ongeldig. We konden eerder geen e-mails naar dit adres sturen.',
                        }),
                    );
                }
                continue;
            }

            if (unsubscribeGlobal && (unsubscribeGlobal.markedAsSpam)) {
                // Ignore
                if (email.callback) {
                    email.callback(
                        new SimpleError({
                            code: 'email_spam',
                            message: 'Recipient has marked as spam',
                            human: 'Dit e-mailadres heeft eerder een e-mail als spam gemarkeerd. We kunnen geen e-mails naar dit adres sturen.',
                        }),
                    );
                }
                continue;
            }

            const unsubscribe = await EmailAddress.getOrCreate(recipient.email, email.fromStamhoofd || !organization ? null : organization.id);
            if (unsubscribe.unsubscribedAll || unsubscribe.hardBounce || unsubscribe.markedAsSpam || !unsubscribe.token || (unsubscribe.unsubscribedMarketing && email.unsubscribeType === 'marketing')) {
                // Ignore
                if (email.callback) {
                    email.callback(
                        new SimpleError({
                            code: 'email_unsubscribed',
                            message: unsubscribe.unsubscribedAll ? 'Recipient has unsubscribed' : (unsubscribe.hardBounce ? 'Recipient has hard bounced' : (unsubscribe.markedAsSpam ? 'Recipient has marked as spam' : 'Recipient has unsubscribed from marketing')),
                        }),
                    );
                }
                continue;
            }

            const unsubscribeUrl = 'https://' + STAMHOOFD.domains.dashboard + '/' + (organization ? (organization.i18n.locale + '/') : '') + 'unsubscribe?id=' + encodeURIComponent(unsubscribe.id) + '&token=' + encodeURIComponent(unsubscribe.token) + '&type=' + encodeURIComponent(email.unsubscribeType ?? 'all');
            recipient.replacements.push(Replacement.create({
                token: 'unsubscribeUrl',
                value: unsubscribeUrl,
            }));

            // Override headers
            recipient.headers = {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
            cleaned.push(recipient);
        }
        catch (e) {
            console.error(e);
        }
    }
    email.recipients = cleaned;

    const fromAddress = Email.parseEmailStr(email.from)[0];

    // Update recipients
    for (const recipient of email.recipients) {
        recipient.replacements = recipient.replacements.slice();

        if (email.defaultReplacements) {
            recipient.replacements.push(...email.defaultReplacements);
        }

        await fillRecipientReplacements(recipient, {
            organization,
            platform,
            fromAddress,
        });
    }

    const queue = email.recipients.slice();

    let emailIndex = 0;

    for (const s of email.replaceAll ?? []) {
        email.html = email.html.replaceAll(s.from, s.to);
    }

    if (queue.length === 0) {
        if (email.callback) {
            email.callback(new SimpleError({
                code: 'no_recipients',
                message: 'No recipients left',
            }));
        }
    }

    // Create e-mail builder
    const builder: EmailBuilder = () => {
        const recipient = queue.shift();
        if (!recipient) {
            return undefined;
        }

        const replacedHtml = replaceHtml(email.html, recipient.replacements);
        const replacedSubject = replaceText(email.subject, recipient.replacements);

        emailIndex += 1;

        return {
            from: email.from,
            replyTo: email.replyTo ?? undefined,
            bcc: emailIndex === 1 ? email.singleBcc : undefined,
            to: [
                {
                    // Name will get cleaned by email service
                    name: (recipient.firstName ?? '') + ' ' + (recipient.lastName ?? ''),
                    email: recipient.email,
                },
            ],
            subject: replacedSubject,
            html: replacedHtml ?? undefined,
            attachments: email.attachments,
            headers: recipient.headers,
            type: email.type,
            callback: email.callback,
        };
    };
    return builder;
}

export async function fillRecipientReplacements(recipient: Recipient, options: {
    organization: Organization | null;
    platform?: PlatformStruct;
    fromAddress: string | null;
}) {
    if (!options.platform) {
        options.platform = await Platform.getSharedPrivateStruct();
    }
    const { organization, platform, fromAddress } = options;
    recipient.replacements = recipient.replacements.slice();

    // Default signInUrl
    let signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/login?email=' + encodeURIComponent(recipient.email);

    const recipientUser = await User.getForAuthentication(organization?.id ?? null, recipient.email, { allowWithoutAccount: true });
    if (!recipientUser || !recipientUser.hasAccount()) {
        // We can create a special token
        signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/account-aanmaken?email=' + encodeURIComponent(recipient.email);
    }

    recipient.replacements.push(Replacement.create({
        token: 'signInUrl',
        value: signInUrl,
    }));

    recipient.replacements.push(
        Replacement.create({
            token: 'loginDetails',
            value: '',
            html: recipientUser && recipientUser.hasAccount() ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml(recipientUser.email)}</strong></em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${Formatter.escapeHtml(recipient.email)}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.</em></p>`,
        }),
    );

    // Load balance of this user
    // todo: only if detected it is used
    if (organization && recipientUser && !recipient.replacements.find(r => r.token === 'balanceTable')) {
        const balanceItemModels = await CachedBalance.balanceForObjects(organization.id, [recipientUser.id], ReceivableBalanceType.user, true);
        const balanceItems = balanceItemModels.map(i => i.getStructure());

        // Get members
        recipient.replacements.push(
            Replacement.create({
                token: 'outstandingBalance',
                value: Formatter.price(balanceItems.reduce((sum, i) => sum + i.priceOpen, 0)),
            }),
            Replacement.create({
                token: 'balanceTable',
                value: '',
                html: BalanceItemStruct.getDetailsHTMLTable(balanceItems),
            }),
        );
    }

    if (fromAddress) {
        recipient.replacements.push(Replacement.create({
            token: 'fromAddress',
            value: fromAddress,
        }));
    }

    recipient.replacements.push(...recipient.getDefaultReplacements());

    if (organization) {
        const extra = organization.meta.getEmailReplacements(organization);
        recipient.replacements.push(...extra);
    }

    // Defaults
    const extra = platform.config.getEmailReplacements();
    recipient.replacements.push(...extra);
}
