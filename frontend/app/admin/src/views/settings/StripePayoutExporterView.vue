<template>
    <LoadingView v-if="!initialized" />
    <SaveView v-else :loading="saving" title="Exporteren" save-text="Exporteren" @save="save">
        <h1>
            Uitbetalingen exporteren
        </h1>

        <div class="split-inputs">
            <STInputBox title="Vanaf" error-fields="startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox title="Tot en met" error-fields="endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            Snel selecteren: <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                    {{ suggestion.name }}
                </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
            </span>
        </p>

        <hr>
        <h2>Tijdzone</h2>
        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useUTCTimezone" />
                </template>
                <h3 class="style-title-list">
                    Gebruik UTC-tijdzone
                </h3>
                <p class="style-description-small">
                    Voor de maandelijkse facturen van Stripe gebruiken we de UTC-tijdzone.
                </p>
            </STListItem>
        </STList>

        <div v-if="runningJobs.length" class="container">
            <hr>
            <h2>Lopende rapporten</h2>
            <STList>
                <STListItem v-for="(runningJob, index) in runningJobs" :key="index">
                    <h3 class="style-title-list">
                        Van {{ formatDate(runningJob.start) }} tot {{ formatDate(runningJob.end) }}
                    </h3>
                    <p v-if="runningJob.count" class="style-description-small">
                        Al {{ runningJob.count }} transacties verwerkt
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoder, DateDecoder,Decoder,field, IntegerDecoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, ErrorBox, LoadingView,SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, Validator } from "@stamhoofd/components";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";

class PayoutExportStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
        start: Date

    @field({ decoder: DateDecoder })
        end: Date

    @field({ decoder: IntegerDecoder })
        count: number
}

class DateRangeSuggestion {
    name: string;
    startDate: Date;
    endDate: Date;

    constructor({ name, startDate, endDate }: { name: string, startDate: Date, endDate: Date }) {
        this.name = name
        this.startDate = startDate
        this.endDate = endDate
    }
}
@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        STList,
        STListItem,
        SaveView,
        DateSelection,
        TimeInput,
        LoadingView
    }
})
export default class StripePayoutExporterView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    loading = false
    initialized = false

    internalStartDate = new Date()
    internalEndDate = new Date()
    useUTCTimezone = true
    dateRangeSuggestions: DateRangeSuggestion[] = []

    runningJobs: PayoutExportStatus[] = []

    created() {
        this.loadJobs().catch(console.error)
    }

    async loadJobs() {
        if (this.loading) {
            return;
        }

        this.loading = true;

        try {
            // do a request and close
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/stripe/payouts/status",
                decoder: new ArrayDecoder(PayoutExportStatus as Decoder<PayoutExportStatus>)
            })
            this.runningJobs = response.data
        } catch (e) {
            this.errorBox = new ErrorBox(e as Error)
        }
        this.loading = false;
        this.initialized = true
    }

    interval: NodeJS.Timeout | null = null

    mounted() {
        this.buildSuggestions()
        this.selectSuggestion(this.dateRangeSuggestions[0])

        this.interval = setInterval(() => {
            this.loadJobs().catch(console.error)
        }, 1000)
    }

    beforeUnmount() {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    get startDate() {
        return this.internalStartDate
    }

    set startDate(value: Date) {
        this.internalStartDate = new Date(value.getTime())
        this.internalStartDate.setHours(0, 0, 0, 0)
        
    }

    get endDate() {
        return this.internalEndDate
    }

    set endDate(value: Date) {
        this.internalEndDate = new Date(value.getTime())
        this.internalEndDate.setHours(23, 59, 59, 0)
    }

    get correctedStartDate() {
        if (this.useUTCTimezone) {
            const date = new Date()
            date.setUTCFullYear(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate())
            date.setUTCHours(0, 0, 0, 0)
            return date
        } else {
            return this.startDate
        }
    }

    get correctedEndDate() {
        if (this.useUTCTimezone) {
            const date = new Date()
            date.setUTCFullYear(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate())
            date.setUTCHours(23, 59, 59, 0)
            return date
        } else {
            return this.endDate
        }
    }

    buildSuggestions() {
        this.dateRangeSuggestions = [
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().startOf("month").toJSDate()),
                startDate: Formatter.luxon().startOf("month").toJSDate(),
                endDate: Formatter.luxon().endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 1 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 1 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 1 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 2 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 2 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 2 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 3 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 3 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 3 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.year(Formatter.luxon().startOf("year").toJSDate()).toString(),
                startDate: Formatter.luxon().startOf("year").toJSDate(),
                endDate: Formatter.luxon().endOf("year").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.year(Formatter.luxon().minus({ year: 1 }).startOf("year").toJSDate()).toString(),
                startDate: Formatter.luxon().minus({ year: 1 }).startOf("year").toJSDate(),
                endDate: Formatter.luxon().minus({ year: 1 }).endOf("year").toJSDate(),
            }),
        ]
    }

    selectSuggestion(suggestion: DateRangeSuggestion) {
        this.startDate = suggestion.startDate
        this.endDate = suggestion.endDate
    }

    isSuggestionSelected(suggestion: DateRangeSuggestion) {
        return Formatter.dateIso(this.startDate) == Formatter.dateIso(suggestion.startDate) && Formatter.dateIso(this.endDate) == Formatter.dateIso(suggestion.endDate)
    }
   
    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true;

        try {
            // do a request and close
            await AdminSession.shared.authenticatedServer.request({
                method: "POST",
                path: "/stripe/payouts",
                body: {
                    start: this.correctedStartDate.getTime(),
                    end: this.correctedEndDate.getTime()
                }
            })
            new Toast("Je ontvangt een e-mail met de uitbetalingen zodra het rapport klaar is", "success").show()
            this.pop({force: true})
        } catch (e) {
            this.errorBox = new ErrorBox(e as Error)
        }
        this.saving = false;
    }
}
</script>
