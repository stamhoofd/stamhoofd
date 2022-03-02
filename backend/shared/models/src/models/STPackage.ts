import { column, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { STPackageMeta, STPackageStatus, STPackageType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { GroupBuilder } from "../helpers/GroupBuilder";

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
        // Todo: if payment failed: temporary set valid until to 2 weeks after last/first failed payment

        return STPackageStatus.create({
            startDate: this.meta.startDate,
            validUntil: this.validUntil,
            removeAt: this.removeAt,
            firstFailedPayment: this.meta.firstFailedPayment
        })
    }
}
