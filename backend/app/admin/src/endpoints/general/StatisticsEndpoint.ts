import { AutoEncoder, DateDecoder, Decoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { STInvoice } from '@stamhoofd/models';
import { Graph, GraphData, STPackageType } from "@stamhoofd/structures"
import { Formatter } from "@stamhoofd/utility"

import { AdminToken } from '../../models/AdminToken';
import { Statistic } from '../../models/Statistic';

type Params = Record<string, never>;
type Query = undefined;

enum GraphType {
    "Revenue" = "Revenue",
    "Organizations" = "Organizations",
    "WebshopCount" = "WebshopCount",
    "WebshopOrders" = "WebshopOrders",
    "WebshopRevenue" = "WebshopRevenue",
    "Members" = "Members",
    "ActiveAdmins" = "ActiveAdmins",
    "RevenueWebshops" = "RevenueWebshops",
    "RevenueMembers" = "RevenueMembers",
    "RevenueTransactions" = "RevenueTransactions",
    "RevenueStripe" = "RevenueStripe",
}
class Body extends AutoEncoder {
    @field({ decoder: new EnumDecoder(GraphType) })
    type: GraphType

    @field({ decoder: DateDecoder })
    start: Date

    @field({ decoder: DateDecoder })
    end: Date
}

type ResponseBody = Graph;

/**
 * This endpoint is only available in development mode
 */
export class StatisticsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/statistics", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);

        let split: "day" | "week" | "month" = "day"
        const diff = request.body.end.getTime()/1000 - request.body.start.getTime()/1000

        if (diff > 32 * 24 * 60 * 60) {
            split = "week"
        }

        if (diff > 8 * 30 * 24 * 60 * 60) {
            split = "month"
        }

        const labels: string[] = []

        const values = new Map<string, GraphData>()
        switch (request.body.type) {
            case "Revenue": 
                values.set('Revenue', GraphData.create({
                    label: "Omzet"
                }))
                break;

            case "RevenueWebshops": 
                values.set('RevenueWebshops', GraphData.create({
                    label: "Omzet webshops"
                }))
                break;

            case "RevenueMembers": 
                values.set('RevenueMembers', GraphData.create({
                    label: "Omzet ledenadmin"
                }))
                break;

            case "RevenueTransactions": 
                values.set('RevenueTransactions', GraphData.create({
                    label: "Omzet transacties"
                }))
                break;

            case "RevenueStripe": 
                values.set('RevenueStripe', GraphData.create({
                    label: "Omzet Stripe"
                }))
                break;

            case "Organizations": 
                values.set('Organizations', GraphData.create({
                    label: "Aantal verenigingen"
                }))
                break

            case "WebshopCount": 
                values.set('WebshopCount', GraphData.create({
                    label: "Aantal webshops"
                }))
                break

            case "WebshopOrders": 
                values.set('WebshopOrders', GraphData.create({
                    label: "Aantal bestellingen"
                }))
                break

            case "WebshopRevenue": 
                values.set('WebshopRevenue', GraphData.create({
                    label: "Omzet op webshops"
                }))
                break

            case "Members": 
                values.set('Members', GraphData.create({
                    label: "Aantal leden"
                }))
                break
            
            case "ActiveAdmins": 
                values.set('ActiveAdmins', GraphData.create({
                    label: "Ingelogde administrators"
                }))
                break

        }

        let pointerLuxon = Formatter.luxon(request.body.end)
        switch (split) {
            case "day": {
                // Go to next day
                pointerLuxon = pointerLuxon.plus({ days: 1 })
                pointerLuxon = pointerLuxon.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                //pointer.setDate(pointer.getDate() + 1)
                //pointer.setHours(0, 0, 0, 0);
                break
            }

            case "week": {
                // Go to next monday at 0 o'clock
                pointerLuxon = pointerLuxon.plus({ weeks: 1 })
                pointerLuxon = pointerLuxon.set({ weekday: 1, hour: 0, minute: 0, second: 0, millisecond: 0 })

                // pointerLuxon = pointerLuxon.plus({ weeks: 1 })
                // pointerLuxon = pointerLuxon.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                // pointer.setDate(pointer.getDate() + ((7 - pointer.getDay()) % 7) + 1) // sun: 0, sat: 6
                // pointer.setHours(0, 0, 0, 0)
                break
            }

            case "month": {
                // Go to first day of next month at 0 o'clock
                pointerLuxon = pointerLuxon.plus({ months: 1 })
                pointerLuxon = pointerLuxon.set({ day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 })

                //pointer.setMonth(pointer.getMonth() + 1)
                //pointer.setDate(1)
                // pointer.setHours(0, 0, 0, 0)
                break
            }
        }

        let pointer = pointerLuxon.toJSDate()

        let startLuxon = Formatter.luxon(request.body.start)
        startLuxon = startLuxon.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        request.body.start = startLuxon.toJSDate()

        const stats = await Statistic.where({ 
            date: {
                sign: ">=",
                value: Formatter.dateIso(request.body.start)
            },
            organizationId: null
        })

        console.log('stats length', stats.length, Formatter.dateIso(request.body.start))

        const invoices = await STInvoice.where({
            createdAt: {
                sign: ">=",
                value: request.body.start
            },
            number: {
                sign: "!=",
                value: null
            }
        })

        // Work from end to start and ignore end date non-exact matching
        let counter = 0
        while (pointer > request.body.start && counter < 500) {
            counter++

            let startLuxon = Formatter.luxon(pointer)
            const endLuxon = Formatter.luxon(pointer)

            let label = ""

            switch (split) {
                case "day": {
                    startLuxon = startLuxon.minus({ days: 1 })
                    label = Formatter.date(startLuxon.toJSDate());
                    break
                }
                case "month": {
                    startLuxon = startLuxon.minus({ months: 1 })
                    label = Formatter.capitalizeFirstLetter(Formatter.month(startLuxon.month))+" "+startLuxon.year
                    break
                }
                case "week": {
                    startLuxon = startLuxon.minus({ weeks: 1 })
                    label = "Week van "+Formatter.date(startLuxon.toJSDate())
                    break
                }
            }

            const start = startLuxon.toJSDate()
            const end = endLuxon.toJSDate()
            const startStr = Formatter.dateIso(start)
            const endStr = Formatter.dateIso(end)

            // Get the data

            // Move on
            labels.unshift(label)

            // Check all  the statistics we need to fetch
            const rev = values.get("Revenue")
            if (rev) {
                // Loop all stats and filter
                let c = 0;
                for (const invoice of invoices) {
                    if (invoice.createdAt >= start && invoice.createdAt < end && invoice.reference === null) {
                        c += invoice.meta.priceWithoutVAT
                        c -= invoice.meta.items.filter(i => i.description === 'Via Buckaroo').reduce((price, item) => price + 20 * item.amount, 0)
                    }
                }
                rev.values.unshift(c)
            }

            const revWebshops = values.get("RevenueWebshops")
            if (revWebshops) {
                // Loop all stats and filter
                let c = 0;
                for (const invoice of invoices) {
                    if (invoice.createdAt >= start && invoice.createdAt < end) {
                        c += invoice.meta.items.filter(i => i.package?.meta.type === STPackageType.Webshops || i.package?.meta.type === STPackageType.SingleWebshop).reduce((price, item) => price + item.price, 0)
                    }
                }
                revWebshops.values.unshift(c)
            }

            const revMembers = values.get("RevenueMembers")
            if (revMembers) {
                // Loop all stats and filter
                let c = 0;
                for (const invoice of invoices) {
                    if (invoice.createdAt >= start && invoice.createdAt < end) {
                        c += invoice.meta.items.filter(i => i.package?.meta.type === STPackageType.Members || i.package?.meta.type === STPackageType.LegacyMembers).reduce((price, item) => price + item.price, 0)
                    }
                }
                revMembers.values.unshift(c)
            }

            const revTransactions = values.get("RevenueTransactions")
            if (revTransactions) {
                // Loop all stats and filter
                let c = 0;
                for (const invoice of invoices) {
                    if (invoice.createdAt >= start && invoice.createdAt < end) {
                        c += invoice.meta.items.filter(i => i.description === 'Via Buckaroo').reduce((price, item) => price + item.price - 20 * item.amount, 0)
                    }
                }
                revTransactions.values.unshift(c)
            }

            const revStripeTransactions = values.get("RevenueStripe")
            if (revStripeTransactions) {
                // Loop all stats and filter
                let c = 0;
                for (const invoice of invoices) {
                    if (invoice.createdAt >= start && invoice.createdAt < end && invoice.reference?.startsWith('stripe-fees-')) {
                        c += invoice.meta.priceWithoutVAT
                    }
                }
                revStripeTransactions.values.unshift(c)
            }

            let o = values.get("Organizations")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.activeOrganizations !== null && stat.date >= startStr && stat.date < endStr) {
                        c = Math.max(c, stat.activeOrganizations)
                    }
                }
                o.values.unshift(c)
            }

            o = values.get("WebshopCount")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.date >= startStr && stat.date < endStr) {
                        c = Math.max(c, stat.activeWebshops)
                    }
                }
                o.values.unshift(c)
            }

            o = values.get("WebshopRevenue")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.date >= startStr && stat.date < endStr) {
                        c += stat.webshopRevenue
                    }
                }
                o.values.unshift(c)
            }

            o = values.get("WebshopOrders")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.date >= startStr && stat.date < endStr) {
                        c += stat.orderCount
                    }
                }
                o.values.unshift(c)
            }

            o = values.get("Members")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.date >= startStr && stat.date < endStr) {
                        c = Math.max(c, stat.memberCount)
                    }
                }
                o.values.unshift(c)
            }

            o = values.get("ActiveAdmins")
            if (o) {
                // Loop all stats and filter
                let c = 0;
                for (const stat of stats) {
                    if (stat.date >= startStr && stat.date < endStr) {
                        c = Math.max(c, stat.activeAdmins)
                    }
                }
                o.values.unshift(c)
            }

            pointer = start
        }


        return new Response(Graph.create({
            labels,
            data: [...values.values()]
        }));
    }
}
