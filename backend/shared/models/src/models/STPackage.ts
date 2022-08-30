import { column, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { Email } from "@stamhoofd/email";
import { EmailTemplateType, Recipient, Replacement, STPackageMeta, STPackageStatus, STPackageType } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { getEmailBuilder } from "../helpers/EmailBuilder";
import { GroupBuilder } from "../helpers/GroupBuilder";
import { EmailTemplate } from "./EmailTemplate";

import { Organization } from "./Organization";

export class STPackage extends Model {
    static table = "stamhoofd_packages";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    /**
     * We keep packages of deleted organizations for statistics, so this doesn't have a foreign key
     */
    @column({ type: "string"})
    organizationId: string

    @column({ type: "json", decoder: STPackageMeta })
    meta: STPackageMeta

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

    @column({ type: "datetime", nullable: true })
    validAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    validUntil: Date | null = null

    @column({ type: "datetime", nullable: true })
    removeAt: Date | null = null

    @column({ type: "integer" })
    emailCount = 0

    @column({ type: "datetime", nullable: true })
    lastEmailAt: Date | null = null

    static async getForOrganization(organizationId: string) {
        const pack1 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: { sign: ">", value: new Date() }})
        const pack2 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: null })

        return [...pack1, ...pack2]
    }

    static async updateOrganizationPackages(organizationId: string) {
        console.log("Updating packages for organization "+organizationId)
        const packages = await this.getForOrganization(organizationId)

        const map = new Map<STPackageType, STPackageStatus>()
        for (const pack of packages) {
            const exist = map.get(pack.meta.type)
            if (exist) {
                exist.merge(pack.createStatus())
            } else {
                map.set(pack.meta.type, pack.createStatus())
            }
        }

        const organization = await Organization.getByID(organizationId)
        if (organization) {
            const didUseMembers = organization.meta.packages.useMembers && organization.meta.packages.useActivities
            organization.meta.packages.packages = map

            await organization.save()
            if (!didUseMembers && organization.meta.packages.useMembers && organization.meta.packages.useActivities) {
                console.log("Building groups and categories for "+organization.id)
                const builder = new GroupBuilder(organization)
                await builder.build()
            }
        } else {
            console.error("Couldn't find organization when updating packages "+organizationId)
        }
    }


    async activate() {
        if (this.validAt !== null) {
            return
        }
        this.validAt = new Date()
        await this.save()

        if (this.meta.didRenewId) {
            const pack = await STPackage.getByID(this.meta.didRenewId)
            if (pack && pack.organizationId === this.organizationId) {
                await pack.didRenew(this)
            }
        }
    }

    async didRenew(renewed: STPackage) {
        this.removeAt = renewed.meta.startDate ?? renewed.validAt ?? new Date()
        this.meta.allowRenew = false
        await this.save()
    }

    async deactivate() {
        if (this.removeAt !== null && this.removeAt <= new Date()) {
            return
        }
        this.removeAt = new Date()
        await this.save()
    }

    /**
     * Create a renewed package, but not yet saved!
     */
    createRenewed(): STPackage {
        if (!this.meta.allowRenew) {
            throw new SimpleError({
                code: "not_allowed",
                message: "Not allowed",
                human: "Je kan dit pakket niet verlengen"
            })
        }

        const pack = new STPackage()
        pack.id = uuidv4()
        pack.meta = this.meta

        // Not yet valid / active (ignored until valid)
        pack.validAt = null
        pack.organizationId = this.organizationId

        pack.meta.startDate = new Date(Math.max(new Date().getTime(), this.validUntil?.getTime() ?? 0))
        pack.meta.paidAmount = 0
        pack.meta.paidPrice = 0
        pack.meta.firstFailedPayment = null
        pack.meta.didRenewId = this.id
        
        // Duration for renewals is always a year ATM
        pack.validUntil = new Date(pack.meta.startDate)
        pack.validUntil.setFullYear(pack.validUntil.getFullYear() + 1)

        // Remove (= not renewable) if not renewed after 3 months
        pack.removeAt = new Date(pack.validUntil)
        pack.removeAt.setMonth(pack.removeAt.getMonth() + 3)

        return pack
    }

    createStatus(): STPackageStatus {
        // TODO: if payment failed: temporary set valid until to 2 weeks after last/first failed payment

        return STPackageStatus.create({
            startDate: this.meta.startDate,
            validUntil: this.validUntil,
            removeAt: this.removeAt,
            firstFailedPayment: this.meta.firstFailedPayment
        })
    }

    async sendExpiryEmail() {
        if (this.removeAt && this.removeAt <= new Date()) {
            this.emailCount += 1
            await this.save()
        }

        let allowDays = 0;
        let type: EmailTemplateType | null = null;

        if (this.meta.type === STPackageType.Members) {
            type = EmailTemplateType.MembersExpirationReminder;
            allowDays = 32;
        } else if (this.meta.type === STPackageType.Webshops) {
            type = EmailTemplateType.WebshopsExpirationReminder;
            allowDays = 32;
        } else if (this.meta.type === STPackageType.SingleWebshop) {
            type = EmailTemplateType.SingleWebshopExpirationReminder;
            allowDays = 7;
        } else if (this.meta.type === STPackageType.TrialMembers) {
            type = EmailTemplateType.TrialMembersExpirationReminder;
            allowDays = 3;
        } else if (this.meta.type === STPackageType.TrialWebshops) {
            type = EmailTemplateType.TrialWebshopsExpirationReminder;
            allowDays = 3;
        }

        const allowFrom = new Date(Date.now() + 1000 * 60 * 60 * 24 * allowDays)
        if (type && (this.validUntil === null || this.validUntil < new Date() || this.validUntil > allowFrom)) {
            console.log('Skip sending expiration email for '+this.id)
            return;
        }

        if (type) {
            console.log('Sending expiration email for '+this.id, type)
            if (STAMHOOFD.environment === "production") {
                await this.sendEmailTemplate({
                    type
                })
            }
            this.lastEmailAt = new Date()
        } else {
            console.log('Skip sending expiration email for '+this.id+' (no type)')
        }
        
        this.emailCount += 1
        await this.save()
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType,
        replyTo?: string
    }) {
        // First fetch template
        let templates = await EmailTemplate.where({ type: data.type, organizationId: null })

        if (!templates || templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const organization = await Organization.getByID(this.organizationId)

        if (!organization) {
            console.error("Could not find package organization "+this.id)
            return
        }

        const template = templates[0]
        const admins = await organization.getAdmins()

        const recipients = admins.map(admin => 
            Recipient.create({
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: admin.firstName ?? ""
                    }),
                    Replacement.create({
                        token: "organizationName",
                        value: organization.name
                    }),
                    Replacement.create({
                        token: "packageName",
                        value: this.meta.name ?? ""
                    }),
                    Replacement.create({
                        token: "validUntil",
                        value: this.validUntil ? Formatter.dateTime(this.validUntil) : "nooit"
                    }),
                    Replacement.create({
                        token: "validUntilDate",
                        value: this.validUntil ? Formatter.date(this.validUntil) : "nooit"
                    }),
                    Replacement.create({
                        token: "renewUrl",
                        value: "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+organization.i18n.locale+"/settings/packages"
                    }),
                ]
            })
        );

        
        // Create e-mail builder
        const builder = await getEmailBuilder(organization, {
            recipients,
            subject: template.subject,
            html: template.html,
            from: Email.getInternalEmailFor(organization.i18n),
            replyTo: data.replyTo
        })

        Email.schedule(builder)
    }
}
