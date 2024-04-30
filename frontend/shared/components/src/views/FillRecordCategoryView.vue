<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="goNext">
        <h1>
            {{ title }}
        </h1>
        <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

        <STErrorsDefault :error-box="errorBox" />
            
        <RecordAnswerInput v-for="record of records" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
        <div v-for="category of childCategories" :key="category.id" class="container">
            <hr>
            <h2>{{ category.name }}</h2>
            <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

            <RecordAnswerInput v-for="record of category.filterRecords(dataPermission)" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
        </div>

        <hr v-if="isOptional && hasSavedAnswers && !isAllEmpty">

        <button v-if="isOptional && hasSavedAnswers && !isAllEmpty" class="button text" type="button" @click="skipStep">
            <span class="icon trash" />
            <span>Wis antwoorden</span>
        </button>

        <p v-if="!markReviewed && lastReviewed" class="style-description-small">
            Laatst nagekeken op {{ formatDate(lastReviewed) }}
        </p>
    </SaveView>
</template>

<script lang="ts">
import { encodeObject } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, RecordAnswerInput, SaveView, STErrorsDefault, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { FilterDefinition, RecordAnswer, RecordCategory, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        RecordAnswerInput
    }
})
export default class FillRecordCategoryView<T> extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ default: null})
        url: string

    @Prop({ required: true })
        category!: RecordCategory

    /**
     * Unaltered record answers
     */
    @Prop({ required: true })
        answers!: RecordAnswer[]

    @Prop({ default: false })
        markReviewed!: boolean

    @Prop({ required: true })
        dataPermission!: boolean

    @Prop({ default: true })
        hasNextStep!: boolean

    /**
     * Type of the filters used (category.filter)
     */
    @Prop({ required: true })
        filterDefinitions!: FilterDefinition<T>[]

    editingAnswers = this.answers.map(a => a.clone())
    lastSavedAnswers = this.answers

    @Prop({ required: true })
        saveHandler: (answers: RecordAnswer[], component: NavigationMixin) => Promise<void>

    @Prop({ required: true })
        filterValueForAnswers: (answers: RecordAnswer[]) => T

    validator = new Validator()
    errorBox: ErrorBox | null = null

    mounted() {
        if (this.url) {
            UrlHelper.setUrl(this.url)
        }
    }

    get filterValue() {
        return this.filterValueForAnswers(this.editingAnswers)
    }

    get records() {
        return this.category.filterRecords(this.dataPermission)
    }

    get childCategories(): RecordCategory[] {
        return this.category.filterChildCategories(this.filterValue, this.filterDefinitions, this.dataPermission)
    }

    get title() {
        return this.category.name
    }

    get isAllEmpty() {
        const allRecords = this.category.getAllRecords()
        return !this.editingAnswers.find(answer => {
            const record = !!allRecords.find(r => r.id == answer.settings.id)
            if (record && !answer.isEmpty) {
                return true
            }
            return false
        })
    }

    get hasSavedAnswers() {
        const allRecords = this.category.getAllRecords()
        return this.lastSavedAnswers.find(answer => {
            const record = !!allRecords.find(r => r.id == answer.settings.id)
            if (record) {
                return true
            }
            return false
        })
    }

    get saveText() {
        if (!this.hasNextStep) {
            return 'Opslaan'
        }
        if (this.isOptional && this.isAllEmpty) {
            return "Sla over"
        }
        return "Volgende"
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    get lastReviewed() {
        const allRecords = this.category.getAllRecords()
        let last: Date | null = null

        for (const answer of this.editingAnswers) {
            const record = !!allRecords.find(r => r.id == answer.settings.id)
            if (record && answer.reviewedAt) {
                // Mark reviewed
                if (!last || answer.reviewedAt < last) {
                    last = answer.reviewedAt
                }
            }
        }
        return last
    }

    get isOptional() {
        return this.category.filter && (this.category.filter.requiredWhen === null || !this.category.filter.requiredWhen.decode(this.filterDefinitions).doesMatch(this.filterValue))
    }

    async skipStep() {
        if (this.loading) {
            return;
        }

        if (this.markReviewed && !await CenteredMessage.confirm(this.hasSavedAnswers && !this.isAllEmpty ? "Antwoorden verwijderen en stap overslaan?" : "Ben je zeker dat je deze stap wilt overslaan?", "Overslaan")) {
            return;
        }

        this.loading = true
        this.errorBox = null

        try {
            const allRecords = this.category.getAllRecords()

            // WARNING!
            // We need to make a copy of the array, ore the Vue components will readd the answers again automatically
           
            // Delete all answers from this catgory
            const editingAnswers = this.editingAnswers.filter(answer => {
                const record = !!allRecords.find(r => r.id == answer.settings.id)
                if (record) {
                    console.log('Deleting answer', answer)
                    return false
                }
                return true
            })
            this.editingAnswers = editingAnswers.slice()
            await this.saveHandler(editingAnswers, this)
            this.lastSavedAnswers = editingAnswers
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async goNext() {
        if (this.loading) {
            return;
        }

        if (this.isOptional && this.isAllEmpty) {
            return await this.skipStep()
        }

        this.loading = true
        this.errorBox = null

        const cachedLastSavedAnswers = this.lastSavedAnswers

        try {
            let valid = await this.validator.validate()

            if (!valid) {
                this.loading = false
                return
            }

            // Delete answers that were filtered out
            const allRecords = this.category.getAllRecords()
            const filteredRecords = this.category.getAllFilteredRecords(this.filterValue, this.filterDefinitions, this.dataPermission)

            const editingAnswers = this.editingAnswers.filter(answer => {
                const record = !!allRecords.find(r => r.id == answer.settings.id)
                const filteredRecord = !!filteredRecords.find(r => r.id == answer.settings.id)

                if (record && !filteredRecord) {
                    console.log('Deleting answer', answer)
                    return false
                }

                if (this.markReviewed && record) {
                    // Mark reviewed
                    answer.markReviewed()
                }
                return true
            })
            this.lastSavedAnswers = editingAnswers
            await this.saveHandler(editingAnswers, this)
        } catch (e) {
            this.lastSavedAnswers = cachedLastSavedAnswers
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async shouldNavigateAway() {
        if (this.isAllEmpty && !this.hasSavedAnswers) {
            return true;
        }

        if (
            JSON.stringify(encodeObject(this.lastSavedAnswers, { version: Version })) == JSON.stringify(encodeObject(this.editingAnswers, { version: Version }))
        ) {
            // Nothing changed
            return true
        }
        if (await CenteredMessage.confirm("Ben je zeker dat je dit venster wilt sluiten zonder op te slaan?", "Sluiten")) {
            return true;
        }
        return false;
    }
}
</script>
