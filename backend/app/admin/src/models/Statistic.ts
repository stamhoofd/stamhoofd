/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { column, Database, Model } from "@simonbackx/simple-database";
import { STPackage, Webshop } from "@stamhoofd/models";
import { OrganizationPackages, STPackageStatus, STPackageType, WebshopStatus } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

export class Statistic extends Model {
    static table = "statistics";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value: string | undefined) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    date: string   

    @column({ type: "string", nullable: true })
    organizationId: string | null

    @column({ type: "integer" })
    activeWebshops = 0

    @column({ type: "integer" })
    memberCount = 0

    @column({ type: "integer" })
    orderCount = 0

    @column({ type: "integer" })
    webshopRevenue = 0

    @column({ type: "integer" })
    activeAdmins = 0

    /**
     * Only used for aggregated ones
     */
    @column({ type: "integer", nullable: true })
    activeOrganizations: number | null = null

    /**
     * Build a time range aggregation for given organizations (or all organizations)
     */
    static async buildTimeAggregation(organizationIds: string[] | null, start: Date, end: Date) {
        let query = `
            select "" as id, concat(organizationId, '') as 'organizationId', min(date) as date, max(activeWebshops) as activeWebshops, max(memberCount) as memberCount, sum(orderCount) as orderCount, sum(webshopRevenue) as webshopRevenue, max(activeAdmins) as activeAdmins 
            from statistics
            where 
                date >= ?
                AND date <= ?
                AND organizationId is not NULL
        `
        
        const params: any[] = [start, end]
        if (organizationIds !== null) {
            query += " AND organizationId IN (?)"
            params.push(organizationIds)
        }
                
        query += ` group by organizationId`
        const results = await Database.select(query, params)
        const stats = this.fromRows(results[0], "")
        return stats
    }

    static async getFor(organizationId: string | null, date: Date) {
        let datetime = Formatter.luxon(date)
        datetime = datetime.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        date = datetime.toJSDate()
        const existing = await Statistic.where({ organizationId, date: Formatter.dateIso(date) }, { limit: 1 })
        if (existing[0]) {
            return existing[0];
        }
        const stat = new Statistic()
        stat.date = Formatter.dateIso(date)
        stat.organizationId = organizationId
        return stat;
    }

    static async updateAggregation(date: Date) {
        let datetime = Formatter.luxon(date)
        datetime = datetime.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        date = datetime.toJSDate()
        
        const stats = await Statistic.where({ organizationId: { sign: "!=", value: null }, date: Formatter.dateIso(date) })
        
        const aggregation = await Statistic.createAggregation(date)
        for (const stat of stats) {
            aggregation.add(stat)
        }
        await aggregation.save()
    }

    static async createAggregation(date: Date) {
        const stat = await this.getFor(null, date);
        stat.activeWebshops = 0
        stat.memberCount = 0
        stat.orderCount = 0
        stat.webshopRevenue = 0
        stat.activeAdmins = 0
        stat.activeOrganizations = 0
        
        return stat
    }

    static async getOrganizationPackagesMap(organizationId: string, date = new Date()): Promise<Map<STPackageType, STPackageStatus>> {
        const packs = [
            STPackage.where({ organizationId, validAt: { sign: "<=", value: date }, validUntil: { sign: ">=", value: date }, removeAt: { sign: ">", value: date }}),
            STPackage.where({ organizationId, validAt: { sign: "<=", value: date }, validUntil: null, removeAt: { sign: ">", value: date }}),
            STPackage.where({ organizationId, validAt: { sign: "<=", value: date }, validUntil: { sign: ">=", value: date }, removeAt: null }),
            STPackage.where({ organizationId, validAt: { sign: "<=", value: date }, validUntil: null, removeAt: null })
        ];

        const packages = (await Promise.all(packs)).flatMap(p => p)

        const map = new Map<STPackageType, STPackageStatus>()
        for (const pack of packages) {
            const exist = map.get(pack.meta.type)
            if (exist) {
                exist.merge(pack.createStatus())
            } else {
                map.set(pack.meta.type, pack.createStatus())
            }
        }

        return map;
    }

    static async buildFor(organizationId: string, date: Date, recalculate = false) {
        let datetime = Formatter.luxon(date)
        datetime = datetime.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        const start = datetime.toJSDate()
        
        datetime = datetime.plus({ days: 1 })
        const end = datetime.toJSDate()

        const stat = await this.getFor(organizationId, start)
        stat.activeOrganizations = 0

        const packagesMap = await this.getOrganizationPackagesMap(organizationId, date)
        const packages = OrganizationPackages.create({ packages: packagesMap })

        if (packages.useMembers && !packages.isMembersTrial) {
            stat.activeOrganizations = 1

            if (!recalculate) {
                // Not safe to recalculate for now
                await stat.calculateMembers(start, end)
            }
        } else {
            stat.memberCount = 0
        }

        if (packages.useWebshops && !packages.isWebshopsTrial) {
            stat.activeOrganizations = 1
            await stat.calculateOrders(start, end)

            // Count active webshops
            const webshops = await Webshop.where({ organizationId })
            stat.activeWebshops = webshops.reduce((c, w) => c + ((w.meta.availableUntil === null || w.meta.availableUntil > start) && w.createdAt < end && w.products.length > 0 && w.meta.status === WebshopStatus.Open ? 1 : 0), 0)
        } else {
            stat.activeWebshops = 0
            stat.orderCount = 0
            stat.webshopRevenue = 0
        }

        if (stat.activeOrganizations) {
            if (!recalculate) {
                // Not safe to recalculate for now
                await stat.calculateAdmins(start, end)
            }
        } else {
            stat.activeAdmins = 0
        }
        
        await stat.save()
        return stat
    }

    private async calculateOrders(start: Date, end: Date) {
        // Count orders
        const query = "SELECT count(*) as c, sum(payments.price) as r from webshop_orders join payments on webshop_orders.paymentId = payments.id WHERE webshop_orders.organizationId = ? AND webshop_orders.validAt is not null AND webshop_orders.validAt >= ? AND webshop_orders.validAt < ? AND webshop_orders.status != 'Canceled' AND webshop_orders.status != 'Deleted' AND payments.price <= 200000"
        const [results] = await Database.select(query, [this.organizationId, start, end])
        const count = results[0]['']['c'];
        const revenue = results[0]['']['r'];

        if (Number.isInteger(count)) {
            this.orderCount = count as number
        } else {
            console.error("Count is not a number in stat query")
            this.orderCount = 0
        }

        if (Number.isInteger(revenue)) {
            this.webshopRevenue = revenue as number
        } else {
            this.webshopRevenue = 0
        }
    }

    private async calculateMembers(start: Date, end: Date) {
        // Count orders
        const query = "SELECT count(distinct memberId) as c from registrations JOIN `groups` on groups.id = registrations.groupId WHERE groups.organizationId = ? AND groups.deletedAt is null AND registeredAt is not null and registeredAt < ? AND registrations.cycle = groups.cycle"
        const [results] = await Database.select(query, [this.organizationId, end])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
            this.memberCount = count as number
        } else {
            console.error("Count is not a number in stat members query")
            this.memberCount = 0
        }
    }

    static async getLastActiveDate(organizationId: string): Promise<Date | null> {
        // Count orders
        const query = "SELECT max(tokens.createdAt) as c from tokens join users on users.id = tokens.userId where users.organizationId = ? AND users.permissions is not null"
        const [results] = await Database.select(query, [organizationId])
        const date = results[0]['']['c'];

        if (date instanceof Date) {
            return date
        } else {
            return null
        }
    }

    private async calculateAdmins(start: Date, end: Date) {
        // Count orders
        const query = "SELECT count(distinct userId) as c from tokens join users on users.id = tokens.userId where users.organizationId = ? AND tokens.createdAt >= ? and tokens.createdAt < ? AND users.permissions is not null"
        const [results] = await Database.select(query, [this.organizationId, start, end])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
            this.activeAdmins = count as number
        } else {
            console.error("Count is not a number in stat activeAdmins query")
            this.activeAdmins = 0
        }
    }

    /**
     * Aggregate multiple statistics for the SAME DAY for different organizations
     */
    add(other: Statistic) {
        this.activeWebshops += other.activeWebshops
        this.memberCount += other.memberCount
        this.orderCount += other.orderCount
        this.webshopRevenue += other.webshopRevenue
        this.activeAdmins += other.activeAdmins

        if (this.activeOrganizations === null) {
            this.activeOrganizations = 0
        }

        if (other.activeOrganizations && other.activeOrganizations > 0) {
            this.activeOrganizations += other.activeOrganizations
        }
    }
}
