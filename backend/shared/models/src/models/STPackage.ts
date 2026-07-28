import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { STPackageMeta, STPackageStatus, STPackageStatusServiceFee, STPackageType, STPricingType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';

export class STPackage extends QueryableModel {
    static table = 'stamhoofd_packages';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * We keep packages of deleted organizations for statistics, so this doesn't have a foreign key
     */
    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'json', decoder: STPackageMeta })
    meta: STPackageMeta;

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

    @column({ type: 'datetime', nullable: true })
    validAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    validUntil: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    removeAt: Date | null = null;

    @column({ type: 'integer' })
    emailCount = 0;

    @column({ type: 'datetime', nullable: true })
    lastEmailAt: Date | null = null;

    /**
     * Helper to handle edge cases where validUntil is null but removeAt is set
     */
    get endDate() {
        if (!this.removeAt) {
            return this.validUntil;
        }
        if (!this.validUntil) {
            return this.removeAt;
        }
        return new Date(Math.min(this.validUntil.getTime(), this.removeAt.getTime()));
    }

    async activate() {
        if (this.validAt !== null) {
            return;
        }
        this.validAt = new Date();
        await this.save();

        if (this.meta.didRenewId) {
            const pack = await STPackage.getByID(this.meta.didRenewId);
            if (pack && pack.organizationId === this.organizationId) {
                await pack.didRenew(this);
            }
        }
    }

    async didRenew(renewed: STPackage) {
        this.removeAt = renewed.meta.startDate ?? renewed.validAt ?? new Date();
        this.meta.allowRenew = false;
        await this.save();
    }

    async deactivate() {
        if (this.removeAt !== null && this.removeAt <= new Date()) {
            return;
        }
        this.removeAt = new Date();
        await this.save();
    }

    /**
     * Create a renewed package, but not yet saved!
     */
    createRenewed(): STPackage {
        if (!this.meta.allowRenew) {
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Not allowed',
                human: $t(`%x7`),
            });
        }

        const pack = new STPackage();
        pack.id = uuidv4();
        pack.meta = this.meta;

        // Not yet valid / active (ignored until valid)
        pack.validAt = null;
        pack.organizationId = this.organizationId;

        pack.meta.startDate = new Date(Math.max(new Date().getTime(), this.validUntil?.getTime() ?? 0));
        pack.meta.paidAmount = 0;
        pack.meta.paidPrice = 0;
        pack.meta.firstFailedPayment = null;
        pack.meta.didRenewId = this.id;

        // Duration for renewals is always a year ATM
        pack.validUntil = new Date(pack.meta.startDate);
        pack.validUntil.setFullYear(pack.validUntil.getFullYear() + 1);

        // Remove (= not renewable) if not renewed after 3 months
        pack.removeAt = new Date(pack.validUntil);
        pack.removeAt.setMonth(pack.removeAt.getMonth() + 3);

        // Custom renewals for single webshop:
        /* if (this.meta.type === STPackageType.SingleWebshop) {
            // Disable functions after two months
            pack.validUntil = new Date(pack.meta.startDate)
            pack.validUntil.setMonth(pack.validUntil.getMonth() + 2)
            pack.removeAt = new Date(pack.validUntil)
        } */
        if (this.meta.type === STPackageType.SingleWebshop) {
            pack.meta.type = STPackageType.Webshops;
        }

        // Change prices
        if (pack.meta.type === STPackageType.Webshops) {
            pack.meta.serviceFeeFixed = 0;
            pack.meta.serviceFeePercentage = 2_00;
            pack.meta.serviceFeeMinimum = 0;
            pack.meta.serviceFeeMaximum = 2000; // 20 cent

            pack.meta.unitPrice = 0;
            pack.meta.pricingType = STPricingType.Fixed;
            pack.validUntil = null;
            pack.removeAt = null;
        } else if (pack.meta.type === STPackageType.Members) {
            pack.meta.serviceFeeFixed = 0;
            pack.meta.serviceFeePercentage = 0;
            pack.meta.serviceFeeMinimum = 0;
            pack.meta.serviceFeeMaximum = 0;

            pack.meta.unitPrice = 1_0000; // 1 euro
            pack.meta.pricingType = STPricingType.PerMember;
        }

        return pack;
    }

    createStatus(): STPackageStatus {
        return STPackageStatus.create({
            startDate: this.meta.startDate,
            validUntil: this.validUntil,
            removeAt: this.removeAt,
            firstFailedPayment: this.meta.firstFailedPayment,
            serviceFees: [
                STPackageStatusServiceFee.create({
                    fixed: this.meta.serviceFeeFixed,
                    percentage: this.meta.serviceFeePercentage,
                    minimum: this.meta.serviceFeeMinimum,
                    maximum: this.meta.serviceFeeMaximum,
                    startDate: this.meta.startDate,
                    endDate: this.validUntil && this.removeAt
                        ? new Date(Math.min(this.validUntil.getTime(), this.removeAt.getTime()))
                        : (this.validUntil ?? this.removeAt),
                },
                )],
        });
    }
}
