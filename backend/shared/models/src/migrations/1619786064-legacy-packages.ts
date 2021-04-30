import { Migration } from '@simonbackx/simple-database';
import { STPackageMeta, STPackageType, STPricingType } from '@stamhoofd/structures';
import { Organization } from '../models/Organization';
import { STPackage } from '../models/STPackage';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        if (organization.meta.modulesOld.useMembers) {
            const pack = new STPackage()
            pack.validAt = new Date()
            pack.validAt.setFullYear(2020)
            pack.validAt.setMonth(8-1)
            pack.validAt.setDate(1)
            pack.validAt.setHours(0, 0, 0, 0)

            pack.organizationId = organization.id
            pack.meta = STPackageMeta.create({
                type: STPackageType.LegacyMembers,
                pricingType: STPricingType.Fixed,
                unitPrice: 0,
                minimumAmount: 1,
                autorenew: false,
                allowRenew: false,
                canDeactivate: true,
                startDate: pack.validAt
            })

            await pack.save()
            console.log("Added legacy members package for "+organization.name)

            if (!organization.meta.modulesOld.disableActivities) {
                // Assign legacy activities package
                const pack = new STPackage()
                pack.validAt = new Date()
                pack.validUntil = new Date()
                pack.validUntil.setDate(pack.validUntil.getDate() + 14)
                pack.removeAt = new Date()
                pack.removeAt.setDate(pack.removeAt.getDate() + 31)

                pack.organizationId = organization.id
                pack.meta = STPackageMeta.create({
                    type: STPackageType.TrialMembers,
                    pricingType: STPricingType.Fixed,
                    unitPrice: 0,
                    minimumAmount: 1,
                    autorenew: false,
                    allowRenew: false,
                    canDeactivate: true,
                    startDate: pack.validAt
                })

                await pack.save()
                console.log("Added members trial package for "+organization.name)
            }
        }

        if (organization.meta.modulesOld.useWebshops) {
            const pack = new STPackage()
            pack.validAt = new Date()
            pack.validUntil = new Date()
            pack.validUntil.setDate(pack.validUntil.getDate() + 14)
            pack.removeAt = new Date()
            pack.removeAt.setDate(pack.removeAt.getDate() + 31)

            pack.organizationId = organization.id
            pack.meta = STPackageMeta.create({
                type: STPackageType.Webshops,
                pricingType: STPricingType.Fixed,
                unitPrice: 0,
                minimumAmount: 1,
                autorenew: false,
                allowRenew: false,
                canDeactivate: true,
                startDate: pack.validAt
            })

            await pack.save()
            console.log("Added temporary webshop package for "+organization.name)
        }

        await STPackage.updateOrganizationPackages(organization.id)
    }
});


