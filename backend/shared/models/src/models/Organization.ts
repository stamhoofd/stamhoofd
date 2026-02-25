import { column, Database } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { EmailInterfaceRecipient } from '@stamhoofd/email';
import { ModelCache, QueryableModel } from '@stamhoofd/sql';
import { Address, appToUri, Country, DNSRecordStatus, EmailTemplateType, Language, OrganizationEmail, OrganizationMetaData, OrganizationPrivateMetaData, Organization as OrganizationStruct, PaymentMethod, PaymentProvider, PrivatePaymentConfiguration, Recipient, Replacement, STPackageType, TransferSettings } from '@stamhoofd/structures';

import { CreateEmailIdentityCommand, DeleteEmailIdentityCommand, GetEmailIdentityCommand, GetEmailIdentityCommandOutput, PutEmailIdentityFeedbackAttributesCommand, PutEmailIdentityMailFromAttributesCommand, SESv2Client } from '@aws-sdk/client-sesv2';

import { v4 as uuidv4 } from 'uuid';

import { QueueHandler } from '@stamhoofd/queues';
import { Formatter } from '@stamhoofd/utility';
import { validateDNSRecords } from '../helpers/DNSValidator.js';
import { sendEmailTemplate } from '../helpers/EmailBuilder.js';
import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData.js';
import { OrganizationRegistrationPeriod, StripeAccount } from './index.js';

export class Organization extends QueryableModel {
    static table = 'organizations';
    // static cache = new ModelCache<Organization>();

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    name: string;

    /// URL to a website page or a Facebook page (including http)
    @column({ type: 'string', nullable: true })
    website: string | null = null;

    /// A custom domain name that is used to host the register application (should be unique)
    // E.g. inschrijven.scoutswetteren.be
    @column({ type: 'string', nullable: true })
    registerDomain: string | null = null;

    // Unique representation of this organization from a string, that is used to provide the default domains
    // in uri.stamhoofd.be
    @column({ type: 'string' })
    uri: string;

    @column({ type: 'string' })
    periodId: string;

    /**
     * Public meta data
     */
    @column({ type: 'json', decoder: OrganizationMetaData })
    meta: OrganizationMetaData = OrganizationMetaData.create({});

    /**
     * Data only accessible by the owners / users with special permissions
     */
    @column({ type: 'json', decoder: OrganizationPrivateMetaData })
    privateMeta: OrganizationPrivateMetaData = OrganizationPrivateMetaData.create({});

    /**
     * Data only accessible by the server
     */
    @column({ type: 'json', decoder: OrganizationServerMetaData })
    serverMeta: OrganizationServerMetaData = OrganizationServerMetaData.create({});

    @column({ type: 'json', decoder: Address })
    address: Address;

    @column({
        type: 'string', beforeSave: function (this: Organization) {
            return this.name + '\n' + this.address.toString();
        },
    })
    searchIndex: string;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    @column({ type: 'boolean' })
    active = true;

    /**
     * Return default locale confiruation
     */
    get i18n() {
        return new I18n(Language.Dutch, this.address.country);
    }

    /**
     * Makes sure empty name is replaced with organization name
     */
    get mappedTransferSettings(): TransferSettings {
        return this.meta.transferSettings.fillMissing(TransferSettings.create({ creditor: this.name }));
    }

    // Methods
    static async getByURI(uri: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`uri\` = ? LIMIT 1`,
            [uri],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByEmail(email: string): Promise<Organization | undefined> {
        if (email.startsWith('noreply-')) {
            // Trim
            email = email.substring('noreply-'.length);
        }

        for (const domain of [
            ...Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {}),
            ...Object.values(STAMHOOFD.domains.defaultTransactionalEmail ?? {}),
        ]) {
            if (email.endsWith('@' + domain)) {
                const uri = email.substring(0, email.length - ('@' + domain).length);
                return await Organization.getByURI(uri);
            }
        }

        const at = email.indexOf('@');
        const domain = email.substring(at + 1);

        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE privateMeta->"$.value.mailDomain" = ? LIMIT 1`,
            [domain],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByRegisterDomain(host: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`registerDomain\` = ? LIMIT 1`,
            [host],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    /**
     * Get an Organization by looking at the host of a request
     * Format is 2331c59a-0cbe-4279-871c-ea9d0474cd54.api.stamhoofd.app
     */
    static async fromApiHost(host: string, options?: { allowInactive?: boolean }): Promise<Organization> {
        if (!host.endsWith('.' + STAMHOOFD.domains.api)) {
            throw new SimpleError({
                code: 'invalid_host',
                message: 'Please specify the organization in the hostname',
            });
        }
        const id = host.substring(0, host.length - STAMHOOFD.domains.api.length - 1);
        const organization = await this.getByID(id);
        if (!organization) {
            throw new SimpleError({
                code: 'invalid_organization',
                message: 'No organization known for host ' + host,
            });
        }

        if (!organization.active && !options?.allowInactive) {
            throw new SimpleError({
                code: 'archived',
                message: 'This organization is archived',
                human: $t(`8bd60208-9101-40cf-9f1d-1fd90cdafd62`),
            });
        }
        return organization;
    }

    /**
     * Potentially includes a path
     */
    getRegistrationUrl(i18n?: { language: Language; locale: string }): string {
        if (this.registerDomain) {
            let d = this.registerDomain;

            if (i18n && i18n.language !== this.i18n.language) {
                d += '/' + i18n.language;
            }

            return d;
        }
        return this.getDefaultRegistrationUrl(i18n);
    }

    getDefaultRegistrationUrl(i18n?: { language: Language; locale: string }): string {
        if (!STAMHOOFD.domains.registration) {
            return STAMHOOFD.domains.dashboard + '/' + (i18n?.locale ?? this.i18n.locale) + '/' + appToUri('registration') + '/' + this.uri;
        }
        let defaultDomain = STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration[''];

        if (i18n && i18n.language !== this.i18n.language) {
            defaultDomain += '/' + i18n.language;
        }

        return this.uri + '.' + defaultDomain;
    }

    get registerUrl() {
        return this.getRegistrationUrl();
    }

    /**
     * @deprecated
     * use getRegistrationUrl
     */
    getHost(i18n?: I18n): string {
        return this.getRegistrationUrl(i18n);
    }

    /**
     * @deprecated
     * Use getDefaultRegistrationUrl
     */
    getDefaultHost(i18n?: I18n): string {
        return this.getDefaultRegistrationUrl(i18n);
    }

    get marketingDomain(): string {
        return STAMHOOFD.domains.marketing[this.address.country] ?? STAMHOOFD.domains.marketing[''];
    }

    getApiHost(): string {
        const defaultDomain = STAMHOOFD.domains.api;
        if (!defaultDomain) {
            throw new Error('Missing hostname in environment');
        }
        return this.id + '.' + defaultDomain;
    }

    private _cachedPeriod?: OrganizationRegistrationPeriod;

    async getPeriod() {
        if (this._cachedPeriod) {
            return this._cachedPeriod;
        }

        const oPeriods = await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, { limit: 1 });

        let oPeriod: OrganizationRegistrationPeriod;
        if (oPeriods.length == 0) {
            // Automatically create a period
            oPeriod = await QueueHandler.schedule('create-missing-organization-period', async () => {
                // Race condition check
                const updatedPeriods = await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, { limit: 1 });

                if (updatedPeriods.length) {
                    return updatedPeriods[0];
                }

                console.log('Automatically creating new organization registration period for organization ' + this.id + ' and period ' + this.periodId + ' - organization period is missing');
                const created = new OrganizationRegistrationPeriod();
                created.organizationId = this.id;
                created.periodId = this.periodId;
                await created.save();
                return created;
            });
        }
        else {
            oPeriod = oPeriods[0];
        }

        this._cachedPeriod = oPeriod;
        return oPeriod;
    }

    getBaseStructure(): OrganizationStruct {
        return OrganizationStruct.create({
            id: this.id,
            active: this.active,
            name: this.name,
            meta: this.meta,
            address: this.address,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            createdAt: this.createdAt,
        });
    }

    getBaseStructureWithPrivateMeta(): OrganizationStruct {
        return OrganizationStruct.create({
            id: this.id,
            active: this.active,
            name: this.name,
            meta: this.meta,
            privateMeta: this.privateMeta,
            address: this.address,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            createdAt: this.createdAt,
        });
    }

    async updateDNSRecords() {
        const organization = this;

        // Check initial status
        let isValidRecords = true;
        for (const record of organization.privateMeta.dnsRecords) {
            if (record.status !== DNSRecordStatus.Valid) {
                isValidRecords = false;
            }
        }

        const { allValid } = await validateDNSRecords(organization.privateMeta.dnsRecords);

        if (organization.registerDomain ?? organization.privateMeta.pendingRegisterDomain) {
            const registerDomainRecord = (organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain) + '.';
            const records = organization.privateMeta.dnsRecords.filter(r => r.name === registerDomainRecord);
            const areRegisterDomainRecordsValid = records.length === 0 || records.every(r => r.status === DNSRecordStatus.Valid);

            if (areRegisterDomainRecordsValid) {
                // We can setup the register domain if needed
                if (organization.privateMeta.pendingRegisterDomain !== null) {
                    organization.registerDomain = organization.privateMeta.pendingRegisterDomain;
                    organization.privateMeta.pendingRegisterDomain = null;

                    console.log('Did set register domain for ' + this.id + ' to ' + organization.registerDomain);
                }
            }
            else {
                // Clear register domain
                if (organization.registerDomain) {
                    // We need to clear it, to prevent sending e-mails with invalid links
                    organization.privateMeta.pendingRegisterDomain = organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain;
                    organization.registerDomain = null;

                    console.log('Cleared register domain for ' + this.id + ' because of invalid non txt records');
                }
            }
        }

        if (allValid) {
            if (organization.privateMeta.pendingMailDomain !== null) {
                organization.privateMeta.mailDomain = organization.privateMeta.pendingMailDomain;
                organization.privateMeta.pendingMailDomain = null;
            }

            const wasUnstable = organization.serverMeta.isDNSUnstable;
            organization.serverMeta.markDNSValid();

            const didSendDomainSetupMail = organization.serverMeta.didSendDomainSetupMail;
            const didSendWarning = organization.serverMeta.DNSRecordWarningCount > 0;
            organization.serverMeta.DNSRecordWarningCount = 0;

            const wasActive = this.privateMeta.mailDomainActive;
            await this.updateAWSMailIdenitity();

            // yay! Do not Save until after doing AWS changes
            await organization.save();

            if (wasUnstable && !organization.serverMeta.isDNSUnstable) {
                console.warn('DNS settings became stable for ' + this.name + ' ' + this.id);

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationStableDNS,
                    bcc: true,
                });
            }
            else if (!wasActive && this.privateMeta.mailDomainActive && (!didSendDomainSetupMail || didSendWarning) && !organization.serverMeta.isDNSUnstable) {
                organization.serverMeta.didSendDomainSetupMail = true;
                await organization.save();

                if (!didSendDomainSetupMail) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDNSSetupComplete,
                    });
                }
                else {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationValidDNS,
                    });
                }
            }
        }
        else {
            // DNS settings gone broken
            if (organization.privateMeta.mailDomain) {
                organization.privateMeta.pendingMailDomain = organization.privateMeta.pendingMailDomain ?? organization.privateMeta.mailDomain;
                organization.privateMeta.mailDomain = null;
            }

            const wasDNSUnstable = organization.serverMeta.isDNSUnstable;

            organization.serverMeta.markDNSFailure();

            // disable AWS emails
            this.privateMeta.mailDomainActive = false;

            // save
            await organization.save();

            if (!wasDNSUnstable && organization.serverMeta.isDNSUnstable) {
                // DNS became instable
                console.warn('DNS settings became instable for ' + this.name + ' ' + this.id);

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationUnstableDNS,
                    bcc: true,
                });
            }
            else if (!organization.serverMeta.isDNSUnstable && organization.serverMeta.didSendDomainSetupMail && organization.serverMeta.DNSRecordWarningCount == 0) {
                organization.serverMeta.DNSRecordWarningCount += 1;
                await organization.save();

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationInvalidDNS,
                });
            }
        }
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType;
        personal?: boolean;
        bcc?: boolean;
    }) {
        const recipients = await this.getAdminRecipients();
        const defaultI18n = new I18n(Language.Dutch, Country.Belgium);
        const i18n = this.i18n;

        const replaceAll = [
            {
                from: defaultI18n.localizedDomains.marketing(),
                to: i18n.localizedDomains.marketing(),
            },
            {
                from: defaultI18n.$t('59b85264-c4c3-4cf6-8923-9b43282b2787'),
                to: i18n.$t('59b85264-c4c3-4cf6-8923-9b43282b2787'),
            },
            {
                from: defaultI18n.$t('6b3555a2-ace4-4f37-a1fd-18921552f2b5'),
                to: i18n.$t('6b3555a2-ace4-4f37-a1fd-18921552f2b5'),
            },
        ];

        // Create e-mail builder
        await sendEmailTemplate(null, {
            replaceAll,
            recipients,
            template: {
                type: data.type,
            },
            singleBcc: data.bcc ? { email: 'simon@stamhoofd.be' } : undefined,
            type: 'transactional',
            defaultReplacements: [
                Replacement.create({
                    token: 'mailDomain',
                    value: this.privateMeta.mailDomain ?? this.privateMeta.pendingMailDomain ?? '',
                }),
            ],
            unsubscribeType: 'marketing',
            fromStamhoofd: true,
        });
    }

    static get forbiddenEmailDomains() {
        return [
            STAMHOOFD.domains.dashboard,
            ...Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {}),
            ...Object.values(STAMHOOFD.domains.defaultTransactionalEmail ?? {}),
        ];
    }

    async deleteAWSMailIdenitity(mailDomain: string) {
        // Protect specific domain names
        if (Organization.forbiddenEmailDomains.includes(mailDomain.toLowerCase())) {
            return;
        }

        if (STAMHOOFD.environment !== 'production') {
            // Temporary ignore this
            return;
        }

        const client = new SESv2Client({});

        // Check if mail identitiy already exists..
        try {
            const cmd = new GetEmailIdentityCommand({
                EmailIdentity: mailDomain,
            });
            const result = await client.send(cmd);

            if (result.VerifiedForSendingStatus === true) {
                console.log('Cant delete AWS mail idenitiy @' + this.id + ' for ' + mailDomain + ': already validated and might be in use by other organizations');
                return;
            }

            console.log('Deleting AWS mail identity @' + this.id + ' for ' + mailDomain);

            const deleteCmd = new DeleteEmailIdentityCommand({
                EmailIdentity: mailDomain,
            });

            await client.send(deleteCmd);
            console.log('Deleted AWS mail idenitiy @' + this.id + ' for ' + this.privateMeta.mailDomain);
        }
        catch (e) {
            console.error('Could not delete AWS email identitiy @' + this.id + ' for ' + this.privateMeta.mailDomain);
            console.error(e);
        }
    }

    /**
     * Create or update the AWS mail idenitiy and also update the active state of the mailDomain
     */
    async updateAWSMailIdenitity() {
        if (this.privateMeta.mailDomain === null) {
            return;
        }

        // Protect specific domain names
        if (['stamhoofd.be', 'stamhoofd.nl', 'stamhoofd.shop', 'stamhoofd.app', 'stamhoofd.email'].includes(this.privateMeta.mailDomain)) {
            console.error('Tried to validate AWS mail identity with protected domains @' + this.id);
            this.privateMeta.mailDomainActive = false;
            return;
        }

        if (STAMHOOFD.environment !== 'production') {
            // Temporary ignore this
            this.privateMeta.mailDomainActive = true;
            return;
        }

        const client = new SESv2Client({});
        const expectedConfigurationSetName = Formatter.slug(STAMHOOFD.platformName + '-domains');

        // Check if mail identitiy already exists..
        let exists = false;
        let existing: GetEmailIdentityCommandOutput | undefined = undefined;
        try {
            const cmd = new GetEmailIdentityCommand({
                EmailIdentity: this.privateMeta.mailDomain,
            });

            existing = await client.send(cmd);
            exists = true;

            console.log('AWS mail idenitiy exists already: just checking the verification status in AWS @' + this.id);

            if (existing.ConfigurationSetName !== expectedConfigurationSetName) {
                // Not allowed to use this identity
                this.privateMeta.mailDomainActive = false;
                console.error('Organization is not allowed to use email identity ' + this.privateMeta.mailDomain + ' @' + this.id + ', got ' + existing.ConfigurationSetName);
                return;
            }

            this.privateMeta.mailDomainActive = existing.VerifiedForSendingStatus ?? false;

            if (existing.VerifiedForSendingStatus !== true) {
                console.error('Not validated @' + this.id);
            }

            if (existing.VerifiedForSendingStatus !== true && existing.DkimAttributes?.Status === 'FAILED') {
                console.error('AWS failed to verify DKIM records. Triggering a forced recheck @' + this.id);

                const deleteCmd = new DeleteEmailIdentityCommand({
                    EmailIdentity: this.privateMeta.mailDomain,
                });
                await client.send(deleteCmd);

                // Recreate it immediately
                exists = false;
            }
        }
        catch (e) {
            console.error(e);
        }

        if (!exists) {
            console.log('Creating email identity in AWS SES...');

            const cmd = new CreateEmailIdentityCommand({
                EmailIdentity: this.privateMeta.mailDomain,
                ConfigurationSetName: expectedConfigurationSetName,
                DkimSigningAttributes: {
                    DomainSigningPrivateKey: this.serverMeta.privateDKIMKey!,
                    DomainSigningSelector: Formatter.slug(STAMHOOFD.platformName),
                },
                Tags: [
                    {
                        Key: 'OrganizationId',
                        Value: this.id,
                    },
                    {
                        Key: 'Environment',
                        Value: STAMHOOFD.environment ?? 'Unknown',
                    },
                ],
            });

            const result = await client.send(cmd);
            this.privateMeta.mailDomainActive = result.VerifiedForSendingStatus ?? false;

            // Disable email forwarding of bounces and complaints
            // We handle this now with the configuration set
            const putFeedbackCmd = new PutEmailIdentityFeedbackAttributesCommand({
                EmailIdentity: this.privateMeta.mailDomain,
                EmailForwardingEnabled: false,
            });

            await client.send(putFeedbackCmd);
        }

        if (this.privateMeta.mailFromDomain && (!exists || (existing && (!existing.MailFromAttributes || existing.MailFromAttributes.MailFromDomain !== this.privateMeta.mailFromDomain)))) {
            // Also set a from domain, to fix SPF
            console.log('Setting mail from domain: ' + this.privateMeta.mailFromDomain + ' for ' + this.id);

            const cmd = new PutEmailIdentityMailFromAttributesCommand({
                EmailIdentity: this.privateMeta.mailDomain,
                BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
                MailFromDomain: this.privateMeta.mailFromDomain,
            });

            await client.send(cmd);
        }
    }

    async checkDrips() {
        const days7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Welcome drip
        // Created maximum 7 days ago
        if (this.createdAt > days7 && !this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWelcome)) {
            await this.sendEmailTemplate({
                type: EmailTemplateType.OrganizationDripWelcome,
                personal: true,
            });

            this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWelcome);
            await this.save();

            return; // Never send more than 1 drip email on the same day
        }

        // Webshop trial checkin
        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin)) {
            if (this.meta.packages.isWebshopsTrial) {
                const activeTime = this.meta.packages.getActiveTime(STPackageType.TrialWebshops);
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopTrialCheckin,
                        personal: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin);
                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin); // also mark members checkin
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // Members trial checkin
        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin)) {
            if (this.meta.packages.isMembersTrial) {
                const activeTime = this.meta.packages.getActiveTime(STPackageType.TrialMembers);
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersTrialCheckin,
                        personal: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin);
                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin); // Also mark webshop trial checkin
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // Webshop trial expired after 1 week
        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired)) {
            if (!this.meta.packages.useWebshops) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops);
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopTrialExpired,
                        personal: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired);
                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialExpired); // also mark members
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersTrialExpired)) {
            if (!this.meta.packages.useMembers) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.TrialMembers);
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersTrialExpired,
                        personal: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialExpired);
                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired); // also mark webshops
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // trial expired reminder (after 10 months)
        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripTrialExpiredReminder)) {
            if (!this.meta.packages.isPaid && !this.meta.packages.wasPaid) {
                const deactivatedTime1 = this.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops);
                const deactivatedTime2 = this.meta.packages.getDeactivatedTime(STPackageType.TrialMembers);

                const deactivatedTime = deactivatedTime1 && deactivatedTime2 ? Math.max(deactivatedTime1, deactivatedTime2) : (deactivatedTime1 ? deactivatedTime1 : deactivatedTime2);

                if (deactivatedTime !== null && deactivatedTime > 10 * 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 13 * 31 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripTrialExpiredReminder,
                        personal: true,
                        bcc: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripTrialExpiredReminder);
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed)) {
            if (!this.meta.packages.useWebshops) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.Webshops);

                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30 * 3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopNotRenewed,
                        personal: true,
                        bcc: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed);
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersNotRenewed)) {
            if (!this.meta.packages.useMembers) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.Members);

                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30 * 3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersNotRenewed,
                        personal: true,
                        bcc: true,
                    });

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersNotRenewed);
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }
    }

    /**
     * E-mail address when we receive replies for organization@stamhoofd.email.
     * Note that this sould be private because it can contain personal e-mail addresses if the organization is not configured correctly
     */
    async getReplyEmails(): Promise<EmailInterfaceRecipient[]> {
        const sender: OrganizationEmail | undefined = this.privateMeta.emails.find(e => e.default) ?? this.privateMeta.emails[0];

        if (sender) {
            return [
                {
                    name: sender.name,
                    email: sender.email,
                },
            ];
        }

        return await this.getAdminToEmails();
    }

    async getAdmins() {
        // Circular reference fix
        const User = (await import('./User.js')).User;
        return await User.getAdmins(this.id, { verified: true });
    }

    /**
     * These email addresess are private
     */
    async getFullAdmins() {
        const admins = await this.getAdmins();

        // Only full access
        return admins.filter(a => a.permissions && a.permissions.forOrganization(this)?.hasFullAccess());
    }

    /**
     * These email addresess are private
     */
    async getAdminToEmails(): Promise<EmailInterfaceRecipient[]> {
        const filtered = await this.getFullAdmins();

        if (STAMHOOFD.environment === 'production') {
            if (filtered.length > 1) {
                // remove stamhoofd email addresses
                const f = filtered.flatMap(f => f.getEmailTo()).filter(e => !e.email.endsWith('@stamhoofd.be') && !e.email.endsWith('@stamhoofd.nl'));
                if (f.length > 0) {
                    return f;
                }
            }
        }

        return filtered.flatMap(f => f.getEmailTo());
    }

    /**
     * These email addresess are private
     */
    async getAdminRecipients(): Promise<Recipient[]> {
        let filtered = await this.getFullAdmins();

        if (STAMHOOFD.environment === 'production') {
            if (filtered.length > 1) {
                // remove stamhoofd email addresses
                filtered = filtered.filter(e => !e.email.endsWith('@stamhoofd.be') && !e.email.endsWith('@stamhoofd.nl'));
            }
        }

        return filtered.flatMap((f) => {
            return Recipient.create({
                firstName: f.firstName,
                lastName: f.lastName,
                email: f.email,
                replacements: [
                    Replacement.create({
                        token: 'organizationName',
                        value: this.name,
                    }),
                ],
            });
        });
    }

    /**
     * Return default e-mail address if no email addresses are set.
     */
    getDefaultFrom(i18n: I18n, type: 'transactional' | 'broadcast' = 'broadcast'): EmailInterfaceRecipient {
        const domain = type === 'transactional' ? i18n.localizedDomains.defaultTransactionalEmail() : i18n.localizedDomains.defaultBroadcastEmail();

        return {
            name: this.name,
            email: ('noreply-' + this.uri + '@' + domain),
        };
    }

    async getPaymentProviderFor(method: PaymentMethod, config: PrivatePaymentConfiguration): Promise<{
        provider: PaymentProvider | null;
        stripeAccount: StripeAccount | null;
    }> {
        let stripeAccount = (config.stripeAccountId ? (await StripeAccount.getByID(config.stripeAccountId)) : null) ?? null;
        if (stripeAccount && stripeAccount.organizationId !== this.id) {
            console.warn('Stripe account ' + stripeAccount.id + ' is not linked to organization ' + this.id);
            stripeAccount = null;
        }
        const provider = this.privateMeta.getPaymentProviderFor(method, stripeAccount?.meta);
        if (provider === null && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(method)) {
            if (!stripeAccount && config.stripeAccountId) {
                console.warn('Missing stripe account id ' + config.stripeAccountId);
            }
            throw new SimpleError({
                code: 'payment_provider_not_configured',
                message: 'Payment provider not configured for ' + method,
                human: $t(`9e44e007-3b35-4edf-979f-41b458d2eb39`),
            });
        }

        if (provider !== PaymentProvider.Stripe && stripeAccount) {
            stripeAccount = null;
        }
        return {
            provider,
            stripeAccount,
        };
    }

    async getConnectedPaymentProviders(): Promise<PaymentProvider[]> {
        const allPaymentMethods = Object.values(PaymentMethod);
        const providers: PaymentProvider[] = [];

        let stripeAccounts: (StripeAccount | null)[] = await StripeAccount.where({ organizationId: this.id, status: 'active' });

        if (stripeAccounts.length === 0) {
            stripeAccounts = [null];
        }

        for (const account of stripeAccounts) {
            for (const method of allPaymentMethods) {
                const provider = this.privateMeta.getPaymentProviderFor(method, account?.meta);
                if (provider && !providers.includes(provider)) {
                    providers.push(provider);
                }
            }
        }

        return providers;
    }
}
