<template>
    <form id="fill-record-category-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1>
                {{ title }}
            </h1>
            <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

            <STErrorsDefault :error-box="errorBox" />
            
            <RecordAnswerInput v-for="record of category.records" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
            <div v-for="category of category.childCategories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <RecordAnswerInput v-for="record of category.records" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
            </div>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary">
                    Volgende
                </button>
            </LoadingButton>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { encodeObject } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage, ErrorBox, LoadingButton,RecordAnswerInput, STErrorsDefault, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { RecordAnswer, RecordCategory, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        RecordAnswerInput,
        LoadingButton,
        BackButton
    }
})
export default class FillRecordCategoryView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    category!: RecordCategory

    /**
     * Unaltered record answers
     */
    @Prop({ required: true })
    answers!: RecordAnswer[]

    @Prop({ default: false })
    markReviewed!: boolean

    editingAnswers = this.answers.map(a => a.clone())

    @Prop({ required: true })
    saveHandler: (answers: RecordAnswer[], component: NavigationMixin) => Promise<void>

    validator = new Validator()
    errorBox: ErrorBox | null = null

    get title() {
        return this.category.name
    }

    async goNext() {
        if (this.loading) {
            return;
        }

        this.loading = true
        this.errorBox = null

        try {
            let valid = await this.validator.validate()

            if (!valid) {
                this.loading = false
                return
            }

            // Mark reviewed
            if (this.markReviewed) {
                const allRecords = this.category.getAllRecords()

                for (const answer of this.editingAnswers) {
                    const record = !!allRecords.find(r => r.id == answer.settings.id)
                    if (record) {
                        // Mark reviewed
                        answer.reviewedAt = new Date()
                    }
                }
            }
            
            await this.saveHandler(this.editingAnswers, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async shouldNavigateAway() {
        if (
            JSON.stringify(encodeObject(this.answers, { version: Version })) == JSON.stringify(encodeObject(this.editingAnswers, { version: Version }))
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
