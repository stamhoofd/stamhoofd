<template>
    <FillRecordCategoryView :save-handler="mappedSaveHandler" :answers="details.recordAnswers" :category="category" :mark-reviewed="true" />
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { MemberDetails, RecordAnswer, RecordCategory } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import FillRecordCategoryView from "./FillRecordCategoryView.vue"

/**
 * This component removes any member specific logic from FillRecordCategoryView and puts it separately so we can reuse
 * FillRecordCategoryView in an non member related context
 */
@Component({
    components: {
        FillRecordCategoryView
    }
})
export default class EditMemberCategoryView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    category!: RecordCategory

    @Prop({ required: true })
    isNew: boolean

    @Prop({ required: true })
    details: MemberDetails

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    async mappedSaveHandler(answers: RecordAnswer[], component: NavigationMixin) {
        this.details.recordAnswers = answers
        await this.saveHandler(this.details, this)
    }
}
</script>
