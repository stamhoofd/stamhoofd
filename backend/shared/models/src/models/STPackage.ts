import { column, Model } from "@simonbackx/simple-database";
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
        }
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    validAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    validUntil: Date | null = null

    @column({ type: "datetime", nullable: true })
    removeAt: Date | null = null

    static async getForOrganization(organizationId: string) {
        return await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: { sign: ">", value: new Date() }})
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
            console.log(map)
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

        // TODO: Update the organizations modules
    }

    createStatus(): STPackageStatus {
        // Todo: if payment failed: temporary set valid until to 2 weeks after last/first failed payment

        return STPackageStatus.create({
            startDate: this.meta.startDate,
            validUntil: this.validUntil,
            removeAt: this.removeAt
        })
    }
}
