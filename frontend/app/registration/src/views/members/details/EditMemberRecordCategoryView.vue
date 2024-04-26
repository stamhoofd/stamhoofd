<template>
    <FillRecordCategoryView ref="component" :save-handler="mappedSaveHandler" :answers="details.recordAnswers" :category="category" :mark-reviewed="true" :filter-value-for-answers="filterValueForAnswers" :filter-definitions="filterDefinitions" :data-permission="dataPermission" />
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { FillRecordCategoryView } from '@stamhoofd/components';
import { MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordAnswer, RecordCategory, RegisterItem, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";



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

    @Prop({ required: false })
        member?: MemberWithRegistrations

    @Prop({ required: true })
        items: RegisterItem[]

    @Prop({ required: true })
        saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    filterValueForAnswers(answers: RecordAnswer[]) {
        const details = this.details.patch({
            recordAnswers: answers as any
        })
        return new MemberDetailsWithGroups(details, this.member, this.items)
    }

    get filterDefinitions() {
        return MemberDetailsWithGroups.getFilterDefinitions(this.$organization, {member: this.member, registerItems: this.items})
    }

    get dataPermission() {
        return this.details.dataPermissions?.value ?? false
    }

    async mappedSaveHandler(answers: RecordAnswer[], component: NavigationMixin) {
        this.details.recordAnswers = answers
        await this.saveHandler(this.details, this)
    }

    async shouldNavigateAway() {
        const component = this.$refs.component as any;
        if (component && component.shouldNavigateAway) {
            return await component.shouldNavigateAway()
        }
        return true
    }

}
</script>
