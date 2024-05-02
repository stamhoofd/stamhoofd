
import { logger, StyledText } from '@simonbackx/simple-logging';
import { Organization } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';

import { StripeInvoicer } from './helpers/StripeInvoicer';
import { StripePayoutReporter } from './helpers/StripePayoutReporter';
import { Statistic } from './models/Statistic';

let lastStatsUpdate: Date | null = null
let lastStatsOrganizationId = ""

async function updateStats() {
    console.log("Updating stats...")

    // Wait for the next day before doing a new check
    const today = new Date()
    if (lastStatsUpdate && Formatter.dateIso(lastStatsUpdate) === Formatter.dateIso(today)) {
        console.log("Stats check done for today")

        // TODO: update intermediate stats for tomorrow
        return
    }

    // We need the statistics from yesterday
    let datetime = Formatter.luxon(today)
    datetime = datetime.minus({ days: 1 })
    datetime = datetime.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    const yesterday  = datetime.toJSDate()

    const organizations = await Organization.where({ id: { sign: '>', value: lastStatsOrganizationId } }, {
        limit: STAMHOOFD.environment === "development" ? 1 : 25,
        sort: ["id"]
    })

    if (organizations.length == 0) {
        // Update aggregation
        await Statistic.updateAggregation(yesterday)

        // Wait again until next day
        lastStatsOrganizationId = ""
        lastStatsUpdate = new Date()
        return
    }

    for (const organization of organizations) {
        console.log("Updating stats for "+organization.name)

        try {
            await Statistic.buildFor(organization.id, yesterday)
        } catch (e) {
            console.error(e)
        }
        
    }

    lastStatsOrganizationId = organizations[organizations.length - 1].id
    
}

let lastStripeInvoice: Date | null = null

async function createStripeInvoices() {
    if (STAMHOOFD.environment !== "production") {
        return;
    }

    console.log("Creating Stripe Invoices...")

    // Wait for the next day before doing a new check
    const today = new Date()
    if (lastStripeInvoice && Formatter.dateIso(lastStripeInvoice) === Formatter.dateIso(today)) {
        console.log("Stripe check done for this day")
        return
    }

    if (!STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log("No stripe key set")
        return
    }
    
    const invoicer = new StripeInvoicer({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
    })
    await invoicer.generateAllInvoices()
    lastStripeInvoice = new Date()
}


let lastStripeReport: Date | null = null

async function createStripeReports() {
    if (STAMHOOFD.environment !== "production") {
        return;
    }

    console.log("Creating Stripe Reports...")

    // Wait for the next day before doing a new check
    const today = new Date()
    if (today.getDate() < 15 || (lastStripeReport && Formatter.dateWithoutDay(lastStripeReport) === Formatter.dateWithoutDay(today))) {
        console.log("Stripe check done for this month")
        return
    }

    if (!STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log("No stripe key set")
        return
    }
    // Previous month
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(new Date(today.getFullYear(), today.getMonth(), 1).getTime() - 1000)
 
    const reporter = new StripePayoutReporter({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
    })

    await reporter.build(previousMonthStart, end);
    await reporter.sendEmail()
    
    lastStripeReport = new Date()
}

let isRunningStats = false;
let isRunningStripeInvoices = false;
let isRunningStripeReports = false;

export function areCronsRunning(): boolean {
    return isRunningStats || isRunningStripeInvoices || isRunningStripeReports;
}

async function run(handler: () => Promise<void>, finallyHandler?: () => void) {
    try {
        await logger.setContext({
            prefixes: [
                new StyledText('[Crons] ').addClass('crons', 'tag')
            ],
            tags: ['crons']
        }, async () => {
            try {
                await handler()
            } catch (e) {
                console.error(new StyledText(e).addClass('error'))
            }
        })
    } catch (e) {
        console.error(new StyledText(e).addClass('error'))
    }
    if (finallyHandler) {
        finallyHandler()
    }
}

export function crons() {
    if (!isRunningStats) {
        isRunningStats = true
        run(updateStats).finally(() => {
            isRunningStats = false
        })
    }

    if (!isRunningStripeInvoices) {
        isRunningStripeInvoices = true
        run(createStripeInvoices).finally(() => {
            isRunningStripeInvoices = false
        })
    }

    if (!isRunningStripeReports) {
        isRunningStripeReports = true
        run(createStripeReports).finally(() => {
            isRunningStripeReports = false
        })
    }
}