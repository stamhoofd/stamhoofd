import { Email, EmailAddress, EmailBuilder, EmailInterfaceRecipient } from '@stamhoofd/email';
import { BalanceItem as BalanceItemStruct, EmailRecipient as EmailRecipientStruct, EmailTemplateType, OrganizationEmail, Platform as PlatformStruct, ReceivableBalanceType, Recipient, replaceEmailHtml, replaceEmailText, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { EmailRecipient, CachedBalance, EmailTemplate, Group, Organization, Platform, User, Webshop } from '../models/index.js';

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
        let from = organization.getDefaultFrom(organization.i18n, options.type ?? 'broadcast');

        const sender: OrganizationEmail | undefined = (preferEmailId ? organization.privateMeta.emails.find(e => e.id === preferEmailId) : null) ?? organization.privateMeta.emails.find(e => e.default) ?? organization.privateMeta.emails[0];
        let replyTo: EmailInterfaceRecipient | undefined = undefined;

        if (sender) {
            replyTo = {
                email: sender.email,
                name: sender.name,
            };

            // Can we send from this e-mail or reply-to?
            if (await canSendFromEmail(sender.email, organization)) {
                from = {
                    email: sender.email,
                    name: sender.name,
                };
                replyTo = undefined;
            }

            // Default to organization name
            if (!from.name) {
                from.name = organization.name;
            }

            if (replyTo) {
                if (!replyTo.name) {
                    replyTo.name = organization.name;
                }
            }
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
    let from: EmailInterfaceRecipient = {
        email: 'hallo@' + domain,
    };

    // Platform
    const sender: OrganizationEmail | undefined = (preferEmailId ? platform.privateConfig.emails.find(e => e.id === preferEmailId) : null) ?? platform.privateConfig.emails.find(e => e.default) ?? platform.privateConfig.emails[0];
    let replyTo: EmailInterfaceRecipient | undefined = undefined;

    if (sender) {
        replyTo = {
            email: sender.email,
            name: sender.name,
        };

        // Are we allowed to send an e-mail from this domain?
        if (await canSendFromEmail(sender.email, null)) {
            // Allowed to send from
            from = {
                email: sender.email,
                name: sender.name,
            };
            replyTo = undefined;
        }

        // Default to platform name
        if (!from.name) {
            from.name = platform.config.name;
        }

        if (replyTo) {
            if (!replyTo.name) {
                replyTo.name = platform.config.name;
            }
        }
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

async function getEmailBuilderForTemplate(organization: Organization | null, options: Omit<EmailBuilderOptions, 'subject' | 'html'> & { template: Omit<EmailTemplateOptions, 'organizationId'> }) {
    const template = await getEmailTemplate({
        ...options.template,
        organizationId: organization?.id ?? null,
    });

    if (!template) {
        if (STAMHOOFD.environment === 'production') {
            console.warn('No email template found for ' + options.template.type);
        }
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
    from: EmailInterfaceRecipient;
    replyTo?: EmailInterfaceRecipient | null;
    subject: string;
    html: string;
    attachments?: { filename: string; path?: string; href?: string; content?: string | Buffer; contentType?: string; encoding?: string }[];
    type?: 'transactional' | 'broadcast';
    unsubscribeType?: 'all' | 'marketing';
    fromStamhoofd?: boolean;
    singleBcc?: EmailInterfaceRecipient;
    replaceAll?: { from: string; to: string }[]; // replace in all e-mails, not recipient dependent
    callback?: (error: Error | null) => void; // for each email
    headers?: Record<string, string>;
};

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
                            code: 'email_skipped_hard_bounce',
                            message: 'Recipient has hard bounced',
                            human: $t(`af49a569-ce88-48d9-ac37-81e594e16c03`),
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
                            code: 'email_skipped_spam',
                            message: 'Recipient has marked as spam',
                            human: $t(`e6523f56-397e-4127-8bf7-8396f6f25a62`),
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
                            code: 'email_skipped_unsubscribed',
                            message: unsubscribe.unsubscribedAll ? 'Recipient has unsubscribed' : (unsubscribe.hardBounce ? 'Recipient has hard bounced' : (unsubscribe.markedAsSpam ? 'Recipient has marked as spam' : 'Recipient has unsubscribed from marketing')),
                            human: $t('ffbebae7-eac3-44fe-863b-25942c5be7d0'),
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
                ...email.headers,
                'List-Unsubscribe': STAMHOOFD.domains.defaultBroadcastEmail !== undefined ? '<mailto:unsubscribe+' + unsubscribe.id + '@' + STAMHOOFD.domains.defaultBroadcastEmail![''] + `>, <${unsubscribeUrl}>` : `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
            cleaned.push(recipient);
        }
        catch (e) {
            console.error(e);
        }
    }
    email.recipients = cleaned;

    // Update recipients
    for (const recipient of email.recipients) {
        recipient.replacements = recipient.replacements.slice();

        if (email.defaultReplacements) {
            recipient.replacements.push(...email.defaultReplacements);
        }

        await fillRecipientReplacements(recipient, {
            organization,
            platform,
            from: email.from,
            replyTo: email.replyTo ?? null,
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

        const replacedHtml = replaceEmailHtml(email.html, recipient.replacements);
        const replacedSubject = replaceEmailText(email.subject, recipient.replacements);

        emailIndex += 1;

        return {
            from: email.from,
            replyTo: email.replyTo ?? undefined,
            bcc: emailIndex === 1 && email.singleBcc ? [email.singleBcc] : undefined,
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

export function mergeReplacement(replacementA: Replacement, replacementB: Replacement): Replacement | false {
    if (replacementA.token !== replacementB.token) {
        return false;
    }

    if (replacementA.token === 'greeting') {
        // Just take the first one
        return replacementA;
    }

    if (replacementA.token === 'unsubscribeUrl') {
        return replacementA;
    }

    if (replacementA.token === 'signInUrl') {
        return replacementA;
    }

    if (replacementA.token === 'loginDetails') {
        // loginDetails are always the same for the same user.
        return replacementA;
    }

    if (replacementA.token === 'objectName') {
        // Add comma if values are not the same
        const aa = replacementA.value.split(', ');

        return Replacement.create({
            token: 'objectName',
            value: Formatter.uniqueArray([...aa, ...replacementB.value.split(', ')]).join(', '),
        });
    }

    return false;
}

/**
 * Remove duplicates
 */
export function cleanReplacements(replacements: Replacement[]) {
    const foundIds: Set<string> = new Set();
    const cleaned: Replacement[] = [];
    for (const r of replacements) {
        if (foundIds.has(r.token)) {
            continue;
        }
        foundIds.add(r.token);
        cleaned.push(r);
    }
    return cleaned;
}

export function removeUnusedReplacements(html: string, replacements: Replacement[]) {
    const cleaned: Replacement[] = [];
    for (const r of cleanReplacements(replacements)) {
        if (html.includes(`{{${r.token}}}`)) {
            cleaned.push(r);
        }
    }
    return cleaned;
}

export function mergeReplacementsIfEqual(replacementsA: Replacement[], replacementsB: Replacement[]): Replacement[] | false {
    replacementsA = cleanReplacements(replacementsA);
    replacementsB = cleanReplacements(replacementsB);

    if (replacementsA.length !== replacementsB.length) {
        return false;
    }

    const merged: Replacement[] = [];
    for (const rA of replacementsA) {
        const rB = replacementsB.find(r => r.token === rA.token);
        if (!rB) {
            return false;
        }

        if (rA.html === rB.html && rA.value === rB.value) {
            merged.push(rA);
            continue;
        }

        const m = mergeReplacement(rA, rB);
        if (!m) {
            return false;
        }
        merged.push(m);
    }

    return merged;
}

/**
 * Filter replacements for display in the backend.
 * @param options.forPreview if true, it will hide sensitive information in the preview that could leak information to admin users
 */
export function stripSensitiveRecipientReplacements(recipient: Recipient | EmailRecipientStruct | EmailRecipient, options: {
    organization: Organization | null;
    willFill?: boolean;
}) {
    const { organization } = options;
    // Remove unsubscribeUrl and signInUrl if present
    recipient.replacements = recipient.replacements.filter(r => r.token !== 'unsubscribeUrl' && r.token !== 'signInUrl');

    if (options.willFill) {
        // Also strip loginDetails, balanceTable and outstandingBalance
        recipient.replacements = recipient.replacements.filter(r => r.token !== 'balanceTable' && r.token !== 'outstandingBalance' && r.token !== 'loginDetails');
        return;
    }

    // Add dummy unsubscribeUrl
    const dummyUnsubscribeUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/unsubscribe?token=example';
    recipient.replacements.push(Replacement.create({
        token: 'unsubscribeUrl',
        value: dummyUnsubscribeUrl,
    }));

    // dummy signInUrl
    const dummySignInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/login';
    recipient.replacements.push(Replacement.create({
        token: 'signInUrl',
        value: dummySignInUrl,
    }));

    // Strip security codes (because we list ALL security codes, also from members a viewer might not have access to)
    recipient.replacements = recipient.replacements.map((r) => {
        if (r.token !== 'loginDetails') {
            return r;
        }
        return Replacement.create({
            ...r,
            // Strip <span class="style-inline-code">(.*)</span> and replace content with XXXX-XXXX-XXXX-XXXX
            html: r.html ? r.html.replace(/<span class="style-inline-code">.*?<\/span>/g, '<span class="style-inline-code">••••</span>') : r.html,
        });
    });
}

/**
 * Fill and hide replacements that don't make sense for web display to the user
 */
export function stripRecipientReplacementsForWebDisplay(recipient: Recipient | EmailRecipientStruct | EmailRecipient, options: {
    organization: Organization | null;
}) {
    const { organization } = options;
    // Remove unsubscribeUrl if present
    recipient.replacements = recipient.replacements.filter(r => r.token !== 'unsubscribeUrl' && r.token !== 'loginDetails' && r.token !== 'greeting');

    // Add dummy unsubscribeUrl
    const dummyUnsubscribeUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard);
    recipient.replacements.push(Replacement.create({
        token: 'unsubscribeUrl',
        value: dummyUnsubscribeUrl,
    }));

    recipient.replacements.push(Replacement.create({
        token: 'loginDetails',
        value: '',
    }));

    recipient.replacements.push(Replacement.create({
        token: 'greeting',
        value: $t('f56ad718-fda0-490e-9120-ee0bd6ebbc43'),
    }));
}

/**
 * @param options.forPreview if true, it will hide sensitive information in the preview that could leak information to admin users
 */
export async function fillRecipientReplacements(recipient: Recipient | EmailRecipientStruct | EmailRecipient, options: {
    organization: Organization | null;
    platform?: PlatformStruct;
    from: EmailInterfaceRecipient | null;
    replyTo: EmailInterfaceRecipient | null;
    forPreview?: boolean;
    forceRefresh?: boolean;
}) {
    if (!options.platform) {
        options.platform = await Platform.getSharedPrivateStruct();
    }
    const { organization, platform, from, replyTo } = options;
    let recipientUser: User | null | undefined = null;
    recipient.replacements = recipient.replacements.slice();
    if (options.forPreview) {
        stripSensitiveRecipientReplacements(recipient, options);
    }

    if (!recipient.email && !recipient.userId) {
        const signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/login';
        recipient.replacements.push(Replacement.create({
            token: 'signInUrl',
            value: signInUrl,
        }));

        if (!recipient.replacements.find(r => r.token === 'loginDetails')) {
            recipient.replacements.push(Replacement.create({
                token: 'loginDetails',
                value: '',
            }));
        }
    }
    else {
        // Default signInUrl
        recipientUser = recipient.userId ? await User.select().where('id', recipient.userId).first(false) : await User.getForAuthentication(organization?.id ?? null, recipient.email!, { allowWithoutAccount: true });
        if (STAMHOOFD.userMode !== 'platform' && recipientUser && recipientUser.organizationId && recipientUser.organizationId !== (organization?.id ?? null)) {
            console.warn('User organization does not match current organization, ignoring userId', recipient.userId, recipientUser.organizationId, organization?.id ?? null);
            recipientUser = null;
        }

        let signInUrl: string;
        if (!recipientUser || !recipientUser.hasAccount()) {
            // We can create a special token
            if (recipientUser) {
                signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/account-aanmaken?email=' + encodeURIComponent(recipientUser?.email);
            }
            else {
                signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/account-aanmaken';
            }
        }
        else {
            signInUrl = 'https://' + (organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard) + '/login?email=' + encodeURIComponent(recipientUser.email);
        }

        recipient.replacements.push(Replacement.create({
            token: 'signInUrl',
            value: signInUrl,
        }));
    }

    if (options.forceRefresh) {
        // Remove loginDetails to force refresh
        recipient.replacements = recipient.replacements.filter(r => r.token !== 'loginDetails');
    }

    if (!recipient.replacements.find(r => r.token === 'loginDetails')) {
        if (recipientUser) {
            const emailEscaped = `<strong>${Formatter.escapeHtml(recipientUser.email)}</strong>`;
            const suffixes: string[] = [];
            if (STAMHOOFD.userMode === 'platform') {
                const { Member } = await import('../models/Member.js');
                const memberIds = await Member.getMemberIdsForUser(recipientUser);
                const members = await Member.getByIDs(...memberIds);
                if (members.length > 0) {
                    for (const member of members) {
                        suffixes.push(
                            $t('e2519632-c495-4629-9ddb-334a4f00e272', {
                                firstName: Formatter.escapeHtml(member.firstName),
                                securityCode: `<span class="style-inline-code">${Formatter.escapeHtml(options.forPreview ? '••••' : Formatter.spaceString(member.details.securityCode ?? '', 4, '-'))}</span>`,
                            }),
                        );
                    }
                }
                else {
                    console.log('No member found for user', recipientUser.id);
                }
            }
            const suffix = suffixes.length > 0 ? (' ' + suffixes.join(' ')) : '';
            recipient.replacements.push(
                Replacement.create({
                    token: 'loginDetails',
                    value: '',
                    html: recipientUser.hasAccount()
                        ? `<p class="description"><em>${$t('5403b466-98fe-48ac-beff-38acf7c9734d', { email: emailEscaped })}${suffix}</em></p>`
                        : `<p class="description"><em>${$t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: emailEscaped })}${suffix}</em></p>`,
                }),
            );
        }
        else {
            if (recipient.email) {
                const emailEscaped = `<strong>${Formatter.escapeHtml(recipient.email)}</strong>`;
                console.log('No user found for email', recipient.email);
                recipient.replacements.push(
                    Replacement.create({
                        token: 'loginDetails',
                        value: '',
                        html: `<p class="description"><em>${$t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: emailEscaped })}</em></p>`,
                    }),
                );
            }
            else {
                recipient.replacements.push(
                    Replacement.create({
                        token: 'loginDetails',
                        value: '',
                        html: '',
                    }),
                );
            }
        }
    }

    if (options.forceRefresh) {
        // Remove loginDetails to force refresh
        recipient.replacements = recipient.replacements.filter(r => r.token !== 'balanceTable' && r.token !== 'outstandingBalance');
    }

    // Load balance of this user
    // todo: only if detected it is used
    if (!recipient.replacements.find(r => r.token === 'balanceTable')) {
        if (organization && recipientUser) {
            const balanceItemModels = await CachedBalance.balanceForObjects(organization.id, [recipientUser.id], ReceivableBalanceType.user);
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
        else {
            recipient.replacements.push(
                Replacement.create({
                    token: 'outstandingBalance',
                    value: Formatter.price(0),
                }),
                Replacement.create({
                    token: 'balanceTable',
                    value: '',
                    html: BalanceItemStruct.getDetailsHTMLTable([]),
                }),
            );
        }
    }

    if (from || replyTo) {
        const fromAddress = replyTo?.email ?? from!.email;

        if (fromAddress) {
            recipient.replacements.push(Replacement.create({
                token: 'fromAddress',
                value: fromAddress,
            }));
        }

        const name = replyTo?.name ?? from?.name;
        if (name) {
            recipient.replacements.push(Replacement.create({
                token: 'fromName',
                value: name,
            }));
        }
    }

    if (recipient instanceof EmailRecipient) {
        recipient.replacements.push(...recipient.getRecipient().getDefaultReplacements());
    }
    else {
        recipient.replacements.push(...recipient.getDefaultReplacements());
    }

    if (organization) {
        const extra = organization.meta.getEmailReplacements(organization);
        recipient.replacements.push(...extra);
    }

    // Defaults
    const extra = platform.config.getEmailReplacements(platform);
    recipient.replacements.push(...extra);

    // Remove duplicates
    cleanReplacements(recipient.replacements);
}
