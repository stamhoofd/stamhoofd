<template>
    <FillRecordCategoryView :save-handler="mappedSaveHandler" :answers="details.recordAnswers" :category="category" :mark-reviewed="true" :filter-value="filterValue" :filter-definitions="filterDefinitions" :data-permission="dataPermission" />
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { FillRecordCategoryView } from '@stamhoofd/components';
import { MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordAnswer, RecordCategory, RegisterItem } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";

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

    get filterValue() {
        return new MemberDetailsWithGroups(this.details, this.member, this.items)
    }

    get filterDefinitions() {
        return MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member: this.member, registerItems: this.items})
    }

    get dataPermission() {
        return this.details.dataPermissions?.value ?? false
    }

    async mappedSaveHandler(answers: RecordAnswer[], component: NavigationMixin) {
        this.details.recordAnswers = answers
        await this.saveHandler(this.details, this)
    }
}
</script>
