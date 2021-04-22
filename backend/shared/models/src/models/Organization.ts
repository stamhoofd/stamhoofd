import { column, Database,Model } from "@simonbackx/simple-database";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Address, DNSRecordStatus, DNSRecordType,Group as GroupStruct, Organization as OrganizationStruct, OrganizationEmail, OrganizationKey, OrganizationMetaData, OrganizationPrivateMetaData, PermissionLevel, Permissions, WebshopPreview } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";
const { Resolver } = require('dns').promises;

import { AWSError } from 'aws-sdk';
import SES from 'aws-sdk/clients/sesv2';
import { PromiseResult } from 'aws-sdk/lib/request';

import { Email } from "@stamhoofd/email";
import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData';
import { Webshop } from './Webshop';

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

    @column({ type: "string" })
    publicKey: string;

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
        if (email.endsWith("@stamhoofd.email")) {
            const uri = email.substring(0, email.length - "@stamhoofd.email".length)
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
        const defaultDomain = process.env.HOSTNAME_REGISTRATION;
        if (!defaultDomain) {
            throw new Error("Missing HOSTNAME_REGISTRATION in environment")
        }
        return this.uri + "." + defaultDomain;
    }

    getApiHost(): string {
        const defaultDomain = process.env.HOSTNAME_API;
        if (!defaultDomain) {
            throw new Error("Missing hostname in environment")
        }
        return this.id+"." + defaultDomain;
    }

    async getStructure(): Promise<OrganizationStruct> {
        const Group = (await import("./Group")).Group
        const groups = await Group.where({organizationId: this.id})

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

        return struct
        
    }

    async getPrivateStructure(permissions: Permissions): Promise<OrganizationStruct> {
        const Group = (await import("./Group")).Group
        const groups = await Group.where({ organizationId: this.id })
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
            groups: groups.map(g => g.getPrivateStructure(permissions)).sort(GroupStruct.defaultSort),
            privateMeta: this.privateMeta,
            webshops: webshops.flatMap(w => {
                if (w.privateMeta.permissions.getPermissionLevel(permissions) === PermissionLevel.None) {
                    return []
                }
                return [WebshopPreview.create(w)]
            })
        })
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
        
        // Revalidate all
        const resolver = new Resolver();
        resolver.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);

        let allValid = true

        // If all non-TXT records are valid, we can already setup the register domain
        let hasAllNonTXT = true

        for (const record of organization.privateMeta.dnsRecords) {
            try {
                switch (record.type) {
                    case DNSRecordType.CNAME: {

                        const addresses: string[] = await resolver.resolveCname(record.name.substr(0, record.name.length - 1))
                        record.errors = null;

                        if (addresses.length == 0) {
                            record.status = DNSRecordStatus.Pending
                            allValid = false
                            hasAllNonTXT = false

                            record.errors = new SimpleErrors(new SimpleError({
                                code: "not_found",
                                message: "",
                                human: "We konden de CNAME-record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                            }))
                        } else if (addresses.length > 1) {
                            record.status = DNSRecordStatus.Failed
                            allValid = false
                            hasAllNonTXT = false

                            record.errors = new SimpleErrors(new SimpleError({
                                code: "too_many_fields",
                                message: "",
                                human: "Er zijn meerdere CNAME records ingesteld voor " + record.name + ", kijk na of je er geen moet verwijderen of per ongeluk meerder hebt aangemaakt"
                            }))
                        } else {
                            if (addresses[0] + "." === record.value) {
                                record.status = DNSRecordStatus.Valid
                            } else {
                                record.status = DNSRecordStatus.Failed
                                allValid = false
                                hasAllNonTXT = false

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: "wrong_value",
                                    message: "",
                                    human: "Er is een andere waarde ingesteld voor de CNAME-record " + record.name + ", kijk na of je geen typfout hebt gemaakt. Gevonden: " + addresses[0] + "."
                                }))
                            }
                        }

                        break;
                    }

                    case DNSRecordType.TXT: {
                        const records: string[][] = await resolver.resolveTxt(record.name.substr(0, record.name.length - 1))

                        record.errors = null;

                        if (records.length == 0) {
                            record.status = DNSRecordStatus.Pending
                            allValid = false

                            record.errors = new SimpleErrors(new SimpleError({
                                code: "not_found",
                                message: "",
                                human: "We konden de TXT-record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                            }))
                        } else if (records.length > 1) {
                            record.status = DNSRecordStatus.Failed
                            allValid = false
                            record.errors = new SimpleErrors(new SimpleError({
                                code: "too_many_fields",
                                message: "",
                                human: "Er zijn meerdere TXT-records ingesteld voor " + record.name + ", kijk na of je er geen moet verwijderen of per ongeluk meerder hebt aangemaakt"
                            }))
                        } else {
                            if (records[0].join("").trim() === record.value.trim()) {
                                record.status = DNSRecordStatus.Valid
                            } else {
                                record.status = DNSRecordStatus.Failed
                                allValid = false

                                record.errors = new SimpleErrors(new SimpleError({
                                    code: "wrong_value",
                                    message: "",
                                    human: "Er is een andere waarde ingesteld voor de TXT-record " + record.name + ", kijk na of je geen typfout hebt gemaakt. Gevonden: " + records[0].join("")
                                }))
                            }
                        }
                        break;
                    }

                }
            } catch (e) {
                console.error(e)
                record.status = DNSRecordStatus.Pending

                if (e.code && e.code == "ENOTFOUND") {
                    record.errors = new SimpleErrors(new SimpleError({
                        code: "not_found",
                        message: "",
                        human: "We konden de record " + record.name + " nog niet vinden. Hou er rekening mee dat het even (tot 24u) kan duren voor we deze kunnen zien."
                    }))
                }
                allValid = false

                if (record.type !== DNSRecordType.TXT) {
                    hasAllNonTXT = false
                }
            }
        }

        if (hasAllNonTXT) {
            // We can setup the register domain if needed
            if (organization.privateMeta.pendingRegisterDomain !== null) {
                organization.registerDomain = organization.privateMeta.pendingRegisterDomain
                organization.privateMeta.pendingRegisterDomain = null;

                console.log("Did set register domain for "+this.id+" to "+organization.registerDomain)
            }
        } else {
            // Clear register domain
            if (organization.registerDomain) {
                organization.privateMeta.pendingRegisterDomain = organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain
                organization.registerDomain = null

                console.log("Cleared register domain for "+this.id+" because of invalid non txt records")
            }
        }

        if (allValid) {
            if (organization.privateMeta.pendingMailDomain !== null) {
                organization.privateMeta.mailDomain = organization.privateMeta.pendingMailDomain
                organization.privateMeta.pendingMailDomain = null;
            }
            organization.serverMeta.firstInvalidDNSRecords = undefined
            organization.serverMeta.DNSRecordWarningCount = 0

            const wasActive = this.privateMeta.mailDomainActive

            if (!wasActive) {
                await this.updateAWSMailIdenitity()
            }

            // yay! Do not Save until after doing AWS changes
            await organization.save()

            if (!wasActive && this.privateMeta.mailDomainActive) {
                // Became valid -> send an e-mail to the organization admins
                const to = await this.getAdminToEmails() ?? "hallo@stamhoofd.be"
                Email.sendInternal({
                    to, 
                    subject: "[Stamhoofd] Jullie domeinnaam is nu actief", 
                    text: "Hallo daar!\n\nGoed nieuws! Vanaf nu is jullie eigen domeinnaam voor Stamhoofd volledig actief. " + (this.meta.modules.useMembers ? "Leden kunnen nu dus inschrijven via " + organization.registerDomain + " en e-mails worden verstuurd vanaf @" + organization.privateMeta.mailDomain : "E-mails worden nu verstuurd vanaf @"+organization.privateMeta.mailDomain) +". \n\nStuur ons gerust je vragen via hallo@stamhoofd.be\n\nVeel succes!\n\nSimon van Stamhoofd"
                })
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

            if (organization.serverMeta.DNSRecordWarningCount < 2 && organization.serverMeta.firstInvalidDNSRecords <= new Date(new Date().getTime() - 1000 * 60 * 60 * 2 - (organization.serverMeta.DNSRecordWarningCount * 1000 * 60 * 60 * 24))) {
                organization.serverMeta.DNSRecordWarningCount += 1
                await organization.save()

                // Became invalid for longer than 2 hours -> send an e-mail to the organization admins
                if (process.env.NODE_ENV === "production") {
                    const to = await this.getAdminToEmails() ?? "hallo@stamhoofd.be"
                    Email.sendInternal({
                        to,
                        subject: "[Stamhoofd] Domeinnaam instellingen ongeldig"+(organization.serverMeta.DNSRecordWarningCount == 2 ? " (herinnering)" : ""),
                        text: "Hallo daar!\n\nBij een routinecontrole hebben we gemerkt dat de DNS-instellingen van jouw domeinnaam niet geldig zijn. Hierdoor kunnen we jouw e-mails niet langer versturen vanaf jullie domeinnaam, maar maken we (tijdelijk) gebruik van @stamhoofd.email. "+(this.meta.modules.useMembers && organization.registerDomain === null ? " Ook jullie inschrijvingspagina is niet meer bereikbaar via jullie domeinnaam." : "")+" Kijken jullie dit zo snel mogelijk na op stamhoofd.app -> instellingen -> personalisatie?\n\nBedankt!\n\nHet Stamhoofd team"
                    })
                }
            }
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
        if (["stamhoofd.be", "stamhoofd.app", "stamhoofd.email"].includes(this.privateMeta.mailDomain)) {
            console.error("Tried to validate AWS mail identity with protected domains @"+this.id)
            this.privateMeta.mailDomainActive = false;
            return
        }

        if (process.env.NODE_ENV != "production") {
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

            // todo: check result
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
            // todo
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
                        "Value": process.env.NODE_ENV ?? "Unknown"
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


    async getKeyHistory(): Promise<OrganizationKey[]> {
        // Todo: we need some performance improvements here, or save the key history separately
        const Member = (await import('./Member')).Member;
        const members = await Member.where({
            organizationId: this.id
        })

        const keys = new Map<string, OrganizationKey>();
        keys.set(
            this.publicKey,
            OrganizationKey.create({
                publicKey: this.publicKey,
                start: new Date()
            })
        )

        for (const member of members) {
            for (const d of member.encryptedDetails) {
                if (d.forOrganization) {
                    const existing = keys.get(d.publicKey)
                    keys.set(
                        d.publicKey,
                        OrganizationKey.create({
                            publicKey: d.publicKey,
                            start: existing && existing.start < d.meta.ownerDate ? existing.start : d.meta.ownerDate,
                            end: existing && !existing.end ? null : (existing && existing.end && existing.end > d.meta.date ? existing.end : d.meta.date)
                        })
                    )
                }
            }
        }

        return [...keys.values()]
    }

    /**
     * E-mail address when we receive replies for organization@stamhoofd.email.
     * Note that this sould be private because it can contain personal e-mail addresses if the organization is not configured correctly
     */
    async getReplyEmails(): Promise<{ emails: string; private: boolean } | undefined> {
        const sender: OrganizationEmail | undefined = this.privateMeta.emails.find(e => e.default) ?? this.privateMeta.emails[0];

        if (sender) {
            if (sender.name) {
                return { emails: '"'+sender.name.replace("\"", "\\\"")+"\" <"+sender.email+">", private: false }
            }  else {
                return { emails: '"'+this.name.replace("\"", "\\\"")+"\" <"+sender.email+">", private: false }
            }
        }

        const privateEmails = await this.getAdminToEmails()

        if (privateEmails) {
            return { emails: privateEmails, private: true }
        }

        return undefined
    }

    /**
     * These email addresess are private
     */
    private async getAdminToEmails() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const admins = await User.where({ organizationId: this.id, permissions: { sign: "!=", value: null }})
        const filtered = admins.filter(a => a.permissions && a.permissions.hasFullAccess())

        if (filtered.length > 0) {
            return filtered.map(f => f.firstName && f.lastName ? '"'+(f.firstName+" "+f.lastName).replace("\"", "\\\"")+"\" <"+f.email+">" : f.email ).join(", ")
        }

        return undefined
    }

    async updateRequestKeysCount() {
        // Circular reference fix
        const User = (await import('./User')).User;
        const query = `select count(*) as c from \`${User.table}\` where organizationId = ? AND requestKeys = 1 AND verified = 1 AND publicKey is not null`
        
        const [results] = await Database.select(query, [this.id])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
            this.privateMeta.requestKeysCount = count
            await this.save()
        } else {
            console.error("Unexpected result for updateRequestKeysCount", results)
        }
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

}
