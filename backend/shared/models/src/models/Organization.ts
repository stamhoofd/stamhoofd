import { column, Database, Model } from "@simonbackx/simple-database";
import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from "@stamhoofd/backend-i18n";
import { Email, EmailInterfaceRecipient } from "@stamhoofd/email";
import { AccessRight, Address, Country, DNSRecordStatus, EmailTemplateType, OrganizationEmail, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationRecordsConfiguration, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Organization as OrganizationStruct, PaymentMethod, PaymentProvider, PrivatePaymentConfiguration, Recipient, Replacement, STPackageType, TransferSettings } from "@stamhoofd/structures";
import { AWSError } from 'aws-sdk';
import SES from 'aws-sdk/clients/sesv2';
import { PromiseResult } from 'aws-sdk/lib/request';
import { v4 as uuidv4 } from "uuid";

import { validateDNSRecords } from "../helpers/DNSValidator";
import { getEmailBuilder } from "../helpers/EmailBuilder";
import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData';
import { EmailTemplate, Group, OrganizationRegistrationPeriod, RegistrationPeriod, StripeAccount } from "./";
import { QueueHandler } from "@stamhoofd/queues";

export class Organization extends Model {
    static table = "organizations";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    name: string;

    /// URL to a website page or a Facebook page (including http)
    @column({ type: "string", nullable: true })
    website: string | null = null;

    /// A custom domain name that is used to host the register application (should be unique)
    // E.g. inschrijven.scoutswetteren.be
    @column({ type: "string", nullable: true })
    registerDomain: string | null = null;

    // Unique representation of this organization from a string, that is used to provide the default domains
    // in uri.stamhoofd.be
    @column({ type: "string" })
    uri: string;

    @column({ type: "string" })
    periodId: string;

    /**
     * Public meta data
     */
    @column({ type: "json", decoder: OrganizationMetaData })
    meta: OrganizationMetaData;

    /**
     * Data only accessible by the owners / users with special permissions
     */
    @column({ type: "json", decoder: OrganizationPrivateMetaData })
    privateMeta: OrganizationPrivateMetaData = OrganizationPrivateMetaData.create({})

    /**
     * Data only accessible by the server
     */
    @column({ type: "json", decoder: OrganizationServerMetaData })
    serverMeta: OrganizationServerMetaData = OrganizationServerMetaData.create({})

    @column({ type: "json", decoder: Address })
    address: Address;

    @column({
        type: "string", beforeSave: function (this: Organization) {
            return this.name+"\n"+this.address.toString()
        }
    })
    searchIndex: string

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({type: 'boolean'})
    active = true;

    /**
     * Return default locale confiruation
     */
    get i18n() {
        return new I18n("nl", this.address.country)
    }

    /**
     * Makes sure empty name is replaced with organization name
     */
    get mappedTransferSettings(): TransferSettings {
        return this.meta.transferSettings.fillMissing(TransferSettings.create({creditor: this.name}));
    }


    // Methods
    static async getByURI(uri: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`uri\` = ? LIMIT 1`,
            [uri]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByEmail(email: string): Promise<Organization | undefined> {
        if (["hallo@stamhoofd.be", "hallo@stamhoofd.nl"].includes(email)) {
            return
        }
        if (email.startsWith('noreply-')) {
            // Trim
            email = email.substring("noreply-".length)
        }
        
        if (email.endsWith("@stamhoofd.email")) {
            const uri = email.substring(0, email.length - "@stamhoofd.email".length)
            return await Organization.getByURI(uri)
        }

        if (email.endsWith("@stamhoofd.be")) {
            const uri = email.substring(0, email.length - "@stamhoofd.be".length)
            return await Organization.getByURI(uri)
        }

        if (email.endsWith("@stamhoofd.nl")) {
            const uri = email.substring(0, email.length - "@stamhoofd.nl".length)
            return await Organization.getByURI(uri)
        }

        const at = email.indexOf("@");
        const domain = email.substring(at+1)

        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE privateMeta->"$.value.mailDomain" = ? LIMIT 1`,
            [domain]
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
            [host]
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
     * + switch country if needed
     */
    static async getFromRequest(request: DecodedRequest<any, any, any>): Promise<Organization> {
        const organization = await Organization.fromApiHost(request.host);

        const i18n = I18n.fromRequest(request)
        i18n.switchToLocale({ country: organization.address.country })

        return organization
    }

    /**
     * Get an Organization by looking at the host of a request
     * Format is 2331c59a-0cbe-4279-871c-ea9d0474cd54.api.stamhoofd.app
     */
    static async fromApiHost(host: string): Promise<Organization> {
        const splitted = host.split('.')
        if (splitted.length < 2) {
            throw new SimpleError({
                code: "invalid_host",
                message: "Please specify the organization in the hostname",
            });
        }
        const id = splitted[0]
        const organization = await this.getByID(id);
        if (!organization) {
            throw new SimpleError({
                code: "invalid_organization",
                message: "No organization known for host " + host,
            });
        }
        return organization;
    }

    /**
     * Potentially includes a path
     */
    getHost(i18n?: I18n): string {
        if (this.registerDomain) {
            let d = this.registerDomain;

            if (i18n && i18n.language != this.i18n.language) {
                d += "/"+i18n.language
            }

            return d;
        }
        return this.getDefaultHost(i18n)
    }

    getDefaultHost(i18n?: I18n): string {
        if (!STAMHOOFD.domains.registration) {
            return STAMHOOFD.domains.dashboard + '/' + (i18n?.locale ?? this.i18n.locale) + '/leden/' + this.uri;
        }
        let defaultDomain = STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration[""];

        if (i18n && i18n.language != this.i18n.language) {
            defaultDomain += "/"+i18n.language
        }

        return this.uri + "." + defaultDomain;
    }

    get marketingDomain(): string {
        return STAMHOOFD.domains.marketing[this.address.country] ?? STAMHOOFD.domains.marketing[""];
    }

    getApiHost(): string {
        const defaultDomain = STAMHOOFD.domains.api;
        if (!defaultDomain) {
            throw new Error("Missing hostname in environment")
        }
        return this.id+"." + defaultDomain;
    }

    async getPeriod({emptyGroups} = {emptyGroups: false}) {
        const oPeriods = await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, {limit: 1})
        const period = await RegistrationPeriod.getByID(this.periodId)

        if (!period) {
            throw new Error("Period not found")
        }

        let oPeriod: OrganizationRegistrationPeriod;
        if (oPeriods.length == 0) {
            // Automatically create a period
            oPeriod = await QueueHandler.schedule('create-missing-organization-period', async () => {
                // Race condition check
                const updatedPeriods =  await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, {limit: 1})

                if (updatedPeriods.length) {
                    return updatedPeriods[0]
                }

                console.log('Automatically creating new organization registration period for organization ' + this.id + ' and period ' + this.periodId + ' - organization period is missing')
                const created = new OrganizationRegistrationPeriod()
                created.organizationId = this.id
                created.periodId = this.periodId
                await created.save()
                return created
            })
        } else {
            oPeriod = oPeriods[0];
        }
        const groups = emptyGroups ? [] : (await (await import("./Group")).Group.getAll(this.id, this.periodId))

        return {
            organizationPeriod: oPeriod,
            period,
            groups
        }
    }

    async getStructure({emptyGroups} = {emptyGroups: false}): Promise<OrganizationStruct> {
        const {groups, organizationPeriod, period} = await this.getPeriod({emptyGroups})

        const struct = OrganizationStruct.create({
            id: this.id,
            name: this.name,
            meta: this.meta,
            address: this.address,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            groups: groups.map(g => g.getStructure()),
            createdAt: this.createdAt,
            period: organizationPeriod.getStructure(period, groups)
        })

        if (this.meta.modules.disableActivities) {
            // Only show groups that are in a given category
            struct.groups = struct.categoryTree.categories[0]?.groups ?? []
        }

        if (emptyGroups) {
            // Reduce data
            struct.meta = struct.meta.clone()
            struct.meta.categories = []
            struct.meta.recordsConfiguration = OrganizationRecordsConfiguration.create({})

        }

        return struct
    }

    async updateDNSRecords() {
        const organization = this;

        // Check initial status
        let isValidRecords = true
        for (const record of organization.privateMeta.dnsRecords) {
            if (record.status != DNSRecordStatus.Valid) {
                isValidRecords = false
            }
        }
        
       const { allValid } = await validateDNSRecords(organization.privateMeta.dnsRecords)

       if (organization.registerDomain ?? organization.privateMeta.pendingRegisterDomain) {
            const registerDomainRecord = (organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain)+"."
            const records = organization.privateMeta.dnsRecords.filter(r => r.name === registerDomainRecord)
            const areRegisterDomainRecordsValid = records.length === 0 || records.every(r => r.status === DNSRecordStatus.Valid)

            if (areRegisterDomainRecordsValid) {
                // We can setup the register domain if needed
                if (organization.privateMeta.pendingRegisterDomain !== null) {
                    organization.registerDomain = organization.privateMeta.pendingRegisterDomain
                    organization.privateMeta.pendingRegisterDomain = null;

                    console.log("Did set register domain for "+this.id+" to "+organization.registerDomain)
                }
            } else {
                // Clear register domain
                if (organization.registerDomain) {
                    // We need to clear it, to prevent sending e-mails with invalid links
                    organization.privateMeta.pendingRegisterDomain = organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain
                    organization.registerDomain = null

                    console.log("Cleared register domain for "+this.id+" because of invalid non txt records")
                }
            }
        }

        if (allValid) {
            if (organization.privateMeta.pendingMailDomain !== null) {
                organization.privateMeta.mailDomain = organization.privateMeta.pendingMailDomain
                organization.privateMeta.pendingMailDomain = null;
            }

            const wasUnstable = organization.serverMeta.isDNSUnstable
            organization.serverMeta.markDNSValid()

            const didSendDomainSetupMail = organization.serverMeta.didSendDomainSetupMail
            const didSendWarning = organization.serverMeta.DNSRecordWarningCount > 0
            organization.serverMeta.DNSRecordWarningCount = 0

            const wasActive = this.privateMeta.mailDomainActive
            await this.updateAWSMailIdenitity()

            // yay! Do not Save until after doing AWS changes
            await organization.save()

            if (wasUnstable && !organization.serverMeta.isDNSUnstable) {
                console.warn('DNS settings became stable for ' + this.name + ' '+this.id)

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationStableDNS,
                    bcc: true
                })

            } else if (!wasActive && this.privateMeta.mailDomainActive && (!didSendDomainSetupMail || didSendWarning) && !organization.serverMeta.isDNSUnstable) {
                organization.serverMeta.didSendDomainSetupMail = true
                await organization.save()

                if (!didSendDomainSetupMail) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDNSSetupComplete
                    })
                } else {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationValidDNS
                    })
                }
            }
        } else {
            // DNS settings gone broken
            if (organization.privateMeta.mailDomain) {
                organization.privateMeta.pendingMailDomain = organization.privateMeta.pendingMailDomain ?? organization.privateMeta.mailDomain
                organization.privateMeta.mailDomain = null
            }

            const wasDNSUnstable = organization.serverMeta.isDNSUnstable

            organization.serverMeta.markDNSFailure()

            // disable AWS emails
            this.privateMeta.mailDomainActive = false

            // save
            await organization.save()

            if (!wasDNSUnstable && organization.serverMeta.isDNSUnstable) {
                // DNS became instable
                console.warn('DNS settings became instable for ' + this.name + ' '+this.id)

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationUnstableDNS,
                    bcc: true
                })
            } else if (!organization.serverMeta.isDNSUnstable && organization.serverMeta.didSendDomainSetupMail && organization.serverMeta.DNSRecordWarningCount == 0) {
                organization.serverMeta.DNSRecordWarningCount += 1
                await organization.save()

                await this.sendEmailTemplate({
                    type: EmailTemplateType.OrganizationInvalidDNS
                })
            }
        }
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType,
        personal?: boolean,
        replyTo?: string,
        bcc?: boolean
    }) {
        // First fetch template
        const templates = (await EmailTemplate.where({ type: data.type, organizationId: null }))

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

        const recipients = await this.getAdminRecipients();

        const defaultI18n = new I18n("nl", Country.Belgium)
        const i18n = this.i18n;

        const replacementStrings = [
            {
                from: defaultI18n.$t("shared.domains.marketing"),
                to: i18n.$t("shared.domains.marketing")
            },
            {
                from: defaultI18n.$t("shared.emails.general"),
                to: i18n.$t("shared.emails.general")
            },
            {
                from: defaultI18n.$t("shared.domains.email"),
                to: i18n.$t("shared.domains.email")
            }
        ];

        let html = template.html;

        for (const s of replacementStrings) {
            html = html.replaceAll(s.from, s.to)
        }

        // Create e-mail builder
        const builder = await getEmailBuilder(this, {
            recipients,
            subject: template.subject,
            html,
            from: data.personal ? Email.getPersonalEmailFor(this.i18n) : Email.getInternalEmailFor(this.i18n),
            singleBcc: data.bcc ? 'simon@stamhoofd.be' : undefined,
            replyTo: data.replyTo,
            type: 'transactional',
            defaultReplacements: [
                Replacement.create({
                    token: 'mailDomain',
                    value: this.privateMeta.mailDomain ?? this.privateMeta.pendingMailDomain ?? ''
                })
            ],
            unsubscribeType: 'marketing',
            fromStamhoofd: true
        })

        Email.schedule(builder)
    }

    async deleteAWSMailIdenitity(mailDomain: string) {

        // Protect specific domain names
        if (["stamhoofd.be", "stamhoofd.nl", "stamhoofd.shop", "stamhoofd.app", "stamhoofd.email"].includes(mailDomain)) {
            return
        }

        if (STAMHOOFD.environment != "production") {
            // Temporary ignore this
            return;
        }

        const sesv2 = new SES();

        // Check if mail identitiy already exists..
        let exists = false
        let existing: PromiseResult<SES.GetEmailIdentityResponse, AWSError> | undefined = undefined
        try {
            existing = await sesv2.getEmailIdentity({
                EmailIdentity: mailDomain
            }).promise()
            exists = true

            // Check if DKIM keys are the same
            if (existing.VerifiedForSendingStatus === true) {
                console.log("Cant delete AWS mail idenitiy @"+this.id+" for "+mailDomain+": already validated and might be in use by other organizations")
                return
            }

            console.log("Deleting AWS mail idenitiy @"+this.id+" for "+mailDomain)

            await sesv2.deleteEmailIdentity({
                EmailIdentity: mailDomain
            }).promise()
            console.log("Deleted AWS mail idenitiy @"+this.id+" for "+this.privateMeta.mailDomain)

        } catch (e) {
            console.error("Could not delete AWS email identitiy @"+this.id+" for "+this.privateMeta.mailDomain)
            console.error(e)
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
        if (["stamhoofd.be", "stamhoofd.nl", "stamhoofd.shop", "stamhoofd.app", "stamhoofd.email"].includes(this.privateMeta.mailDomain)) {
            console.error("Tried to validate AWS mail identity with protected domains @"+this.id)
            this.privateMeta.mailDomainActive = false;
            return
        }

        if (STAMHOOFD.environment != "production") {
            // Temporary ignore this
            this.privateMeta.mailDomainActive = true;
            return;
        }

        const sesv2 = new SES();

        // Check if mail identitiy already exists..
        let exists = false
        let existing: PromiseResult<SES.GetEmailIdentityResponse, AWSError> | undefined = undefined
        try {
            existing = await sesv2.getEmailIdentity({
                EmailIdentity: this.privateMeta.mailDomain
            }).promise()
            exists = true

            console.log("AWS mail idenitiy exists already: just checking the verification status in AWS @"+this.id)

            if (existing.ConfigurationSetName !== "stamhoofd-domains") {
                // Not allowed to use this identity
                this.privateMeta.mailDomainActive = false;
                console.error("Organization is not allowed to use email identity "+this.privateMeta.mailDomain+" @"+this.id+", got "+existing.ConfigurationSetName)
                return;
            }

            this.privateMeta.mailDomainActive = existing.VerifiedForSendingStatus ?? false

            if (existing.VerifiedForSendingStatus !== true) {
                console.error("Not validated @"+this.id)
            }
            
            if (existing.VerifiedForSendingStatus !== true && existing.DkimAttributes?.Status === "FAILED") {
                console.error("AWS failed to verify DKIM records. Triggering a forced recheck @"+this.id)
                await sesv2.deleteEmailIdentity({
                    EmailIdentity: this.privateMeta.mailDomain
                }).promise()

                // Recreate it immediately
                exists = false
            }
        } catch (e) {
            console.error(e)
        }

        if (!exists) {
            console.log("Creating email identity in AWS SES...")

            const result = await sesv2.createEmailIdentity({
                EmailIdentity: this.privateMeta.mailDomain,
                ConfigurationSetName: "stamhoofd-domains",
                DkimSigningAttributes: {
                    DomainSigningPrivateKey: this.serverMeta.privateDKIMKey!,
                    DomainSigningSelector: "stamhoofd"
                },
                Tags: [
                    {
                        "Key": "OrganizationId",
                        "Value": this.id
                    },
                    {
                        "Key": "Environment",
                        "Value": STAMHOOFD.environment ?? "Unknown"
                    }
                ]

            }).promise()
            this.privateMeta.mailDomainActive = result.VerifiedForSendingStatus ?? false

            // Disable email forwarding of bounces and complaints
            // We handle this now with the configuration set
            await sesv2.putEmailIdentityFeedbackAttributes({
                EmailIdentity: this.privateMeta.mailDomain,
                EmailForwardingEnabled: false
            }).promise()
        }

        if (this.privateMeta.mailFromDomain && (!exists || (existing && (!existing.MailFromAttributes || existing.MailFromAttributes.MailFromDomain !== this.privateMeta.mailFromDomain)))) {
            // Also set a from domain, to fix SPF
            console.log("Setting mail from domain: "+this.privateMeta.mailFromDomain+" for "+this.id)
            const params = {
                EmailIdentity: this.privateMeta.mailDomain,
                BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
                MailFromDomain: this.privateMeta.mailFromDomain,
            };
            await sesv2.putEmailIdentityMailFromAttributes(params).promise();
        }
    }

    async checkDrips() {
        const days7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        // Welcome drip
        // Created maximum 7 days ago
        if (this.createdAt > days7 && !this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWelcome)) {
            await this.sendEmailTemplate({
                type: EmailTemplateType.OrganizationDripWelcome,
                personal: true
            })

            this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWelcome);
            await this.save();

            return; // Never send more than 1 drip email on the same day
        }

        // Webshop trial checkin
        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin)) {
            if (this.meta.packages.isWebshopsTrial) {
                const activeTime = this.meta.packages.getActiveTime(STPackageType.TrialWebshops)
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopTrialCheckin,
                        personal: true
                    })

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
                const activeTime = this.meta.packages.getActiveTime(STPackageType.TrialMembers)
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersTrialCheckin,
                        personal: true
                    })

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
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops)
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopTrialExpired,
                        personal: true
                    })

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired);
                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialExpired); // also mark members
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersTrialExpired)) {
            if (!this.meta.packages.useMembers) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.TrialMembers)
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersTrialExpired,
                        personal: true
                    })

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
                const deactivatedTime1 = this.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops)
                const deactivatedTime2 = this.meta.packages.getDeactivatedTime(STPackageType.TrialMembers)

                const deactivatedTime = deactivatedTime1 && deactivatedTime2 ? Math.max(deactivatedTime1, deactivatedTime2) : (deactivatedTime1 ? deactivatedTime1 : deactivatedTime2)

                if (deactivatedTime !== null && deactivatedTime > 10 * 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 13 * 31 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripTrialExpiredReminder,
                        personal: true,
                        bcc: true
                    })

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripTrialExpiredReminder);
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed)) {
            if (!this.meta.packages.useWebshops) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.Webshops)
                
                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30*3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripWebshopNotRenewed,
                        personal: true,
                        bcc: true
                    })

                    this.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed);
                    await this.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!this.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersNotRenewed)) {
            if (!this.meta.packages.useMembers) {
                const deactivatedTime = this.meta.packages.getDeactivatedTime(STPackageType.Members)
                
                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30*3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate({
                        type: EmailTemplateType.OrganizationDripMembersNotRenewed,
                        personal: true,
                        bcc: true
                    })

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
                    email: sender.email
                }
            ]
        }

        return await this.getAdminToEmails()
    }

    /**
     * These email addresess are private
     */
    async getFullAdmins() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const admins = await User.getAdmins([this.id], {verified: true})

        // Only full access
        return admins.filter(a => a.permissions && a.permissions.forOrganization(this)?.hasFullAccess())
    }

    /**
     * These email addresess are private
     */
    async getAdminToEmails(): Promise<EmailInterfaceRecipient[]> {
        const filtered = await this.getFullAdmins()

        if (STAMHOOFD.environment === "production") {
            if (filtered.length > 1) {
                // remove stamhoofd email addresses
                const f = filtered.flatMap(f => f.getEmailTo() ).filter(e => !e.email.endsWith("@stamhoofd.be") && !e.email.endsWith("@stamhoofd.nl"))
                if (f.length > 0) {
                    return f
                }
            }
        }

        return filtered.flatMap(f => f.getEmailTo() )
    }

    /**
     * These email addresess are private
     */
    async getAdminRecipients(): Promise<Recipient[]> {
        let filtered = await this.getFullAdmins()

        if (STAMHOOFD.environment === "production") {
            if (filtered.length > 1) {
                // remove stamhoofd email addresses
                filtered = filtered.filter(e => !e.email.endsWith("@stamhoofd.be") && !e.email.endsWith("@stamhoofd.nl"))
            }
        }

        return filtered.flatMap(f => {
            return Recipient.create({
                firstName: f.firstName,
                lastName: f.lastName,
                email: f.email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: f.firstName ?? ""
                    }),
                    Replacement.create({
                        token: "lastName",
                        value: f.lastName ?? ""
                    }),
                    Replacement.create({
                        token: "email",
                        value: f.email
                    }),
                    Replacement.create({
                        token: "organizationName",
                        value: this.name
                    })
                ]
            })
        } )
    }

    /**
     * These email addresess are private
     */
    async getInvoicingToEmails() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const admins = await User.where({ organizationId: this.id, permissions: { sign: "!=", value: null }})
        const filtered = admins.filter(a => a.permissions?.forOrganization(this)?.hasAccessRight(AccessRight.OrganizationFinanceDirector))

        if (filtered.length > 0) {
            return filtered.map(f => f.getEmailTo() ).join(", ")
        }

        return undefined
    }
    
    /**
     * Return default e-mail address for important e-mails that should have the highest deliverability
     */
    getStrongEmail(i18n: I18n, withName = true) {
        if (!withName) {
            return ('noreply-' + this.uri+"@"+i18n.$t("shared.domains.email"));
        }
        return '"'+this.name.replaceAll("\"", "\\\"")+'" <'+ ('noreply-' + this.uri+"@"+i18n.$t("shared.domains.email")) +'>'
    }

    getEmail(id: string | null, strongDefault = false): { from: string; replyTo: string | undefined } {
        if (id === null) {
            return this.getDefaultEmail(strongDefault)
        }
        
        // Send confirmation e-mail
        let from = strongDefault ? this.getStrongEmail(this.i18n, false) : this.uri+"@stamhoofd.email";
        const sender: OrganizationEmail | undefined = this.privateMeta.emails.find(e => e.id === id)
        let replyTo: string | undefined = undefined

        if (sender) {
            replyTo = sender.email

            // Can we send from this e-mail or reply-to?
            if (replyTo && this.privateMeta.mailDomain && this.privateMeta.mailDomainActive && sender.email.endsWith("@"+this.privateMeta.mailDomain)) {
                from = sender.email
                replyTo = undefined
            }

            // Include name in form field
            if (sender.name) {
                from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }  else {
                from = '"'+this.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }  else {
                    replyTo = '"'+this.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }
            }
            return { from, replyTo }
        }
        return this.getDefaultEmail(strongDefault)
    }

    getGroupEmail(group: Group) {
        return this.getEmail(group.privateSettings.defaultEmailId)
    }

    getDefaultEmail(strongDefault = false): { from: string; replyTo: string | undefined } {
        // Send confirmation e-mail
        let from = strongDefault ? this.getStrongEmail(this.i18n, false) : this.uri+"@stamhoofd.email";
        const sender: OrganizationEmail | undefined = this.privateMeta.emails.find(e => e.default) ?? this.privateMeta.emails[0];
        let replyTo: string | undefined = undefined

        if (sender) {
            replyTo = sender.email

            // Can we send from this e-mail or reply-to?
            if (replyTo && this.privateMeta.mailDomain && this.privateMeta.mailDomainActive && sender.email.endsWith("@"+this.privateMeta.mailDomain)) {
                from = sender.email
                replyTo = undefined
            }

            // Include name in form field
            if (sender.name) {
                from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }  else {
                from = '"'+this.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }  else {
                    replyTo = '"'+this.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }
            }
        } else {
            from = '"'+this.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }

        return {
            from, replyTo
        }
    }

    async getPaymentProviderFor(method: PaymentMethod, config: PrivatePaymentConfiguration): Promise<{
        provider: PaymentProvider | null,
        stripeAccount: StripeAccount | null
    }>  {
        let stripeAccount = (config.stripeAccountId ? (await StripeAccount.getByID(config.stripeAccountId)) : null) ?? null
        if (stripeAccount && stripeAccount.organizationId !== this.id) {
            console.warn('Stripe account '+stripeAccount.id+' is not linked to organization '+this.id);
            stripeAccount = null
        }
        const provider = this.privateMeta.getPaymentProviderFor(method, stripeAccount?.meta)
        if (provider === null && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(method)) {
            if (!stripeAccount && config.stripeAccountId) {
                console.warn('Missing stripe account id ' + config.stripeAccountId);
            }
            throw new SimpleError({
                code: 'payment_provider_not_configured',
                message: 'Payment provider not configured for '+method,
                human: 'Deze betaalmethode werd helaas niet volledig geconfigureerd. Probeer later even opnieuw, neem contact met ons op of kies een andere betaalmethode.'
            })
        }
        return {
            provider,
            stripeAccount
        }
    }

    async getConnectedPaymentProviders(): Promise<PaymentProvider[]> {
        const allPaymentMethods = Object.values(PaymentMethod)
        const providers: PaymentProvider[] = []

        let stripeAccounts: (StripeAccount|null)[] = await StripeAccount.where({ organizationId: this.id, status: 'active' })

        if (stripeAccounts.length === 0) {
            stripeAccounts = [null]
        }

        for (const account of stripeAccounts) {
            for (const method of allPaymentMethods) {
                const provider = this.privateMeta.getPaymentProviderFor(method, account?.meta)
                if (provider && !providers.includes(provider)) {
                    providers.push(provider)
                }
            }
        }

        return providers
    }
}
