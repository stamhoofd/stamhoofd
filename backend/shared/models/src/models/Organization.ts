import { column, Database, Model } from "@simonbackx/simple-database";
import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from "@stamhoofd/backend-i18n";
import { Email, EmailInterfaceRecipient } from "@stamhoofd/email";
import { Address, DNSRecordStatus, Group as GroupStruct, GroupStatus, Organization as OrganizationStruct, OrganizationEmail, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationRecordsConfiguration, PaymentMethod, PaymentProvider, PermissionLevel, Permissions, PrivatePaymentConfiguration, TransferSettings, WebshopPreview } from "@stamhoofd/structures";
import { AWSError } from 'aws-sdk';
import SES from 'aws-sdk/clients/sesv2';
import { PromiseResult } from 'aws-sdk/lib/request';
import { v4 as uuidv4 } from "uuid";

import { validateDNSRecords } from "../helpers/DNSValidator";
import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData';
import { Group, StripeAccount, UserWithOrganization, Webshop } from "./";

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

    /**
     * @deprecated
     */
    @column({ type: "string" })
    publicKey = '';

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

    getHost(): string {
        if (this.registerDomain) {
            return this.registerDomain;
        }
        return this.getDefaultHost()
    }

    getDefaultHost(): string {
        const defaultDomain = STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration[""];
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

    async getStructure({emptyGroups} = {emptyGroups: false}): Promise<OrganizationStruct> {
        const groups = emptyGroups ? [] : (await (await import("./Group")).Group.getAll(this.id))

        const struct = OrganizationStruct.create({
            id: this.id,
            name: this.name,
            meta: this.meta,
            address: this.address,
            publicKey: this.publicKey,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            groups: groups.map(g => g.getStructure())
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

    async getPrivateStructure(user?: UserWithOrganization): Promise<OrganizationStruct> {
        const Group = (await import("./Group")).Group
        const groups = await Group.getAll(this.id)
        const webshops = await Webshop.where({ organizationId: this.id }, { select: Webshop.selectColumnsWithout(undefined, "products", "categories")})
        return OrganizationStruct.create({
            id: this.id,
            name: this.name,
            meta: this.meta,
            address: this.address,
            publicKey: this.publicKey,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            groups: groups.map(g => g.getPrivateStructure(user)).sort(GroupStruct.defaultSort),
            privateMeta: this.privateMeta,
            webshops: webshops.flatMap(w => {
                if (user && (!w.privateMeta.permissions.userHasAccess(user, PermissionLevel.Read) && !w.privateMeta.scanPermissions.userHasAccess(user, PermissionLevel.Read))) {
                    return []
                }
                return [WebshopPreview.create(w)]
            })
        })
    }

    async cleanCategories(groups: {id: string}[]) {
        const reachable = new Map<string, boolean>()
        const queue = [this.meta.rootCategoryId]
        reachable.set(this.meta.rootCategoryId, true)
        let shouldSave = false;

        while (queue.length > 0) {
            const id = queue.shift()
            if (!id) {
                break
            }

            const category = this.meta.categories.find(c => c.id === id)
            if (!category) {
                continue
            }

            for (const i of category.categoryIds) {
                if (!reachable.get(i)) {
                    reachable.set(i, true)
                    queue.push(i)
                }
            }

            // Remove groupIds that no longer exist
            const filtered = category.groupIds.filter(id => groups.find(g => g.id === id))
            if (filtered.length !== category.groupIds.length) {
                shouldSave = true;
                console.log("Deleted "+ (filtered.length -  category.groupIds.length) +" group ids from category " + category.id + ", in organization "+this.id)
                category.groupIds = filtered
            }
        }

        const reachableCategoryIds = [...reachable.keys()]

        // Delete all categories that are not reachable anymore
        const beforeCount = this.meta.categories.length;
        this.meta.categories = this.meta.categories.filter(c => reachableCategoryIds.includes(c.id))

        if (this.meta.categories.length !== beforeCount) {
            console.log("Deleted "+ (beforeCount - this.meta.categories.length) +" categories from organization "+this.id)
            await this.save()
        } else {
            if (shouldSave) {
                await this.save()
            }
        }
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

            organization.serverMeta.firstInvalidDNSRecords = undefined

            const didSendDomainSetupMail = organization.serverMeta.didSendDomainSetupMail
            const didSendWarning = organization.serverMeta.DNSRecordWarningCount > 0
            organization.serverMeta.DNSRecordWarningCount = 0

            const wasActive = this.privateMeta.mailDomainActive
            await this.updateAWSMailIdenitity()

            // yay! Do not Save until after doing AWS changes
            await organization.save()

            if (!wasActive && this.privateMeta.mailDomainActive && (!didSendDomainSetupMail || didSendWarning)) {
                organization.serverMeta.didSendDomainSetupMail = true
                await organization.save()

                // Became valid -> send an e-mail to the organization admins
                const to = await this.getAdminToEmails() ?? "hallo@stamhoofd.be"

                if (!didSendDomainSetupMail) {
                    Email.sendInternal({
                        to, 
                        subject: "Jullie domeinnaam is actief", 
                        text: "Hallo daar!\n\nGoed nieuws! Vanaf nu is jullie eigen domeinnaam voor Stamhoofd volledig actief. " + (this.meta.modules.useMembers ? "Leden kunnen nu dus inschrijven via " + organization.registerDomain + " en e-mails worden verstuurd vanaf @" + organization.privateMeta.mailDomain : "E-mails worden nu verstuurd vanaf @"+organization.privateMeta.mailDomain) +". \n\nStuur ons gerust je vragen via "+this.i18n.$t("shared.emails.general")+"\n\nVeel succes!\n\nSimon van Stamhoofd"
                    }, this.i18n)
                } else {
                    Email.sendInternal({
                        to, 
                        subject: "Domeinnaam instellingen zijn terug geldig", 
                        text: "Hallo daar!\n\nGoed nieuws! Bij een routinecontrole hebben we gemerkt dat de DNS-instellingen van jullie domeinnaam terug geldig zijn. Vanaf nu is jullie eigen domeinnaam voor Stamhoofd dus terug volledig actief.\n\nMet vriendelijke groeten,\nStamhoofd"
                    }, this.i18n)
                }
            }
        } else {
            // DNS settings gone broken
            if (organization.privateMeta.mailDomain) {
                organization.privateMeta.pendingMailDomain = organization.privateMeta.pendingMailDomain ?? organization.privateMeta.mailDomain
                organization.privateMeta.mailDomain = null
            }

            if (!organization.serverMeta.firstInvalidDNSRecords) {
                console.error("DNS settings became invalid for "+this.name+" ("+this.id+")")
                organization.serverMeta.firstInvalidDNSRecords = new Date()
            }

            // disable AWS emails
            this.privateMeta.mailDomainActive = false

            // save
            await organization.save()

            // Only send a warning once
            if (organization.serverMeta.DNSRecordWarningCount == 0 && organization.serverMeta.firstInvalidDNSRecords <= new Date(new Date().getTime() - 1000 * 60 * 60 * 24 - (organization.serverMeta.DNSRecordWarningCount * 1000 * 60 * 60 * 24))) {
                organization.serverMeta.DNSRecordWarningCount += 1
                await organization.save()

                // Became invalid for longer than 24 hours -> send an e-mail to the organization admins
                if (STAMHOOFD.environment === "production") {
                    const to = await this.getAdminToEmails() ?? "hallo@stamhoofd.be"
                    Email.sendInternal({
                        to,
                        subject: "Domeinnaam instellingen ongeldig"+(organization.serverMeta.DNSRecordWarningCount == 2 ? " (herinnering)" : ""),
                        text: "Hallo daar!\n\nIn Stamhoofd hebben jullie een eigen domeinnaam ("+ organization.privateMeta.pendingMailDomain +") gekoppeld. Bij een routinecontrole hebben we gemerkt dat de DNS-instellingen van jullie domeinnaam niet (meer) geldig zijn. Hierdoor kunnen we e-mails niet langer versturen vanaf jullie domeinnaam, maar moeten we gebruik maken van @stamhoofd.email. "+(this.meta.modules.useMembers && organization.registerDomain === null ? " Ook het ledenportaal is niet meer bereikbaar via jullie domeinnaam." : "")+" Je stuurt deze e-mail best door naar de persoon in jullie vereniging die de technische zaken regelt. Kijken jullie dit zo snel mogelijk na op Stamhoofd?\n\nOp onze website vind je een gids met meer informatie: https://"+ organization.marketingDomain  +"/docs/domeinnaam-koppelen/\n\nBedankt!\n\nHet Stamhoofd team"
                    }, this.i18n)
                }
            }
        }
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
    async getAdmins() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const admins = await User.where({ organizationId: this.id, permissions: { sign: "!=", value: null }})

        let filtered = admins.filter(a => a.permissions && a.permissions.hasFullAccess(this.privateMeta.roles))

        // Hide api accounts
        filtered = filtered.filter(a => !a.isApiUser)

        return filtered
    }

    /**
     * These email addresess are private
     */
    async getAdminToEmails(): Promise<EmailInterfaceRecipient[]> {
        const filtered = await this.getAdmins()

        if (filtered.length > 1) {
            // remove stamhoofd email addresses
            const f = filtered.flatMap(f => f.getEmailTo() ).filter(e => !e.email.endsWith("@stamhoofd.be") && !e.email.endsWith("@stamhoofd.nl"))
            if (f.length > 0) {
                return f
            }
        }
        return filtered.flatMap(f => f.getEmailTo() )
    }

    /**
     * These email addresess are private
     */
    async getInvoicingToEmails() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const admins = await User.where({ organizationId: this.id, permissions: { sign: "!=", value: null }})
        const filtered = admins.filter(a => a.permissions && (a.permissions.hasFullAccess(this.privateMeta.roles) || a.permissions.hasFinanceAccess(this.privateMeta.roles)))

        if (filtered.length > 0) {
            return filtered.map(f => f.getEmailTo() ).join(", ")
        }

        return undefined
    }
    
    /**
     * Return default e-mail address for important e-mails that should have the highest deliverability
     */
    getStrongEmail(i18n: I18n) {
        return '"'+this.name.replace("\"", "\\\"")+'" <'+ ('noreply-' + this.uri+"@"+i18n.$t("shared.domains.email")) +'>'
    }

    getEmail(id: string | null): { from: string; replyTo: string | undefined } {
        if (id === null) {
            return this.getDefaultEmail()
        }
        
        // Send confirmation e-mail
        let from = this.uri+"@stamhoofd.email";
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
                from = '"'+sender.name.replace("\"", "\\\"")+"\" <"+from+">" 
            }  else {
                from = '"'+this.name.replace("\"", "\\\"")+"\" <"+from+">" 
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"'+sender.name.replace("\"", "\\\"")+"\" <"+replyTo+">" 
                }  else {
                    replyTo = '"'+this.name.replace("\"", "\\\"")+"\" <"+replyTo+">" 
                }
            }
            return { from, replyTo }
        }
        return this.getDefaultEmail()
    }

    getGroupEmail(group: Group) {
        return this.getEmail(group.privateSettings.defaultEmailId)
    }

    getDefaultEmail(): { from: string; replyTo: string | undefined } {
        // Send confirmation e-mail
        let from = this.uri+"@stamhoofd.email";
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
                from = '"'+sender.name.replace("\"", "\\\"")+"\" <"+from+">" 
            }  else {
                from = '"'+this.name.replace("\"", "\\\"")+"\" <"+from+">" 
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"'+sender.name.replace("\"", "\\\"")+"\" <"+replyTo+">" 
                }  else {
                    replyTo = '"'+this.name.replace("\"", "\\\"")+"\" <"+replyTo+">" 
                }
            }
        } else {
            from = '"'+this.name.replace("\"", "\\\"")+"\" <"+from+">" 
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
