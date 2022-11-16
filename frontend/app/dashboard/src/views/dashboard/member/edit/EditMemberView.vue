<template>
    <SaveView :title="member ? member.details.name : 'Nieuw lid'" :loading="loading" @save="save">
        <h1 v-if="member">
            Wijzig gegevens van {{ member.details.firstName }}
        </h1>
        <h1 v-else>
            Nieuw lid toevoegen
        </h1>

        <STErrorsDefault :error-box="errorBox" />
        <EditMemberGeneralView v-model="memberDetails" :member="member" :family-manager="familyManager" :validator="validator" />

        <EditMemberContactsView v-model="memberDetails" :member="member" :family-manager="familyManager" :validator="validator" />

        <template v-if="dataPermissionsEnabled">
            <hr>
            <h2>{{ dataPermissionsTitle }}</h2>
            
            <Checkbox v-model="dataPermissionsValue">
                Er werd toestemming gegeven
            </Checkbox>

            <p v-if="dataPermissionsChangeDate" class="style-description-small">
                Laatst gewijzigd op {{ formatDate(dataPermissionsChangeDate) }}
            </p>
        </template>

        <template v-if="financialSupportEnabled">
            <hr>
            <h2>{{ financialSupportTitle }}</h2>
            <Checkbox v-model="financialSupportValue">
                {{ financialSupportLabel }}
            </Checkbox>

            <p v-if="financialSupportChangeDate" class="style-description-small">
                Laatst gewijzigd op {{ formatDate(financialSupportChangeDate) }}
            </p>
        </template>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr>
            <h2>{{ category.name }}</h2>

            <STList v-if="category.childCategories.length > 0">
                <STListItem v-for="child of filterRecordCategories(category.childCategories)" :key="child.id" :selectable="true" @click="editRecordCategory(child)">
                    <h3 class="style-title-list">
                        {{ child.name }}
                    </h3>
                    <p v-if="getCategoryFillStatus(child)" class="style-description-small">
                        {{ getCategoryFillStatus(child) }}
                    </p>

                    <button slot="right" type="button" class="button text">
                        <span class="icon edit" />
                        <span class="hide-small">Bewerken</span>
                    </button>
                </STListItem>
            </STList>
            <RecordAnswerInput v-for="record of category.filterRecords(dataPermissionsValue)" v-else :key="record.id" :record-settings="record" :record-answers="memberDetails.recordAnswers" :validator="validator" :all-optional="true" />
        </div>
    </SaveView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, FillRecordCategoryView, LoadingButton, RecordAnswerInput, SaveView, SegmentedControl, STErrorsDefault, STList, STListItem, STToolbar, Validator } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import { BooleanStatus, DataPermissionsSettings, FinancialSupportSettings, MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordAnswer, RecordCategory, Version } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from "../../../../classes/FamilyManager";
import { OrganizationManager } from "../../../../classes/OrganizationManager";
import EditMemberContactsView from './EditMemberContactsView.vue';
import EditMemberGeneralView from './EditMemberGeneralView.vue';
import EditMemberGroupView from './EditMemberGroupView.vue';

@Component({
    components: {
        SaveView,
        SegmentedControl,
        BackButton,
        STToolbar,
        LoadingButton,
        EditMemberGeneralView,
        EditMemberContactsView,
        STErrorsDefault,
        STList,
        STListItem,
        RecordAnswerInput,
        Checkbox
    },
})
export default class EditMemberView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ default: null })
    initialFamily!: FamilyManager | null;

    @Prop({ default: null })
    member!: MemberWithRegistrations | null;

    familyManager = this.initialFamily ?? new FamilyManager(this.member ? [this.member] : []);

    memberDetails = this.member ? this.member.details.clone() : MemberDetails.create({})// do not link with member, only link on save!

    validator = new Validator()

    errorBox: ErrorBox | null = null

    OrganizationManager = OrganizationManager

    get supportSettings(): FinancialSupportSettings {
        return OrganizationManager.organization.meta.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})
    }

    get financialSupportEnabled() {
        return OrganizationManager.organization.meta.recordsConfiguration.financialSupport !== null
    }

    get financialSupportTitle() {
        return this.supportSettings.title || FinancialSupportSettings.defaultTitle
    }

    get financialSupportLabel() {
        return this.supportSettings.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel
    }

    get financialSupportValue() {
        return this.memberDetails.requiresFinancialSupport?.value ?? false
    }

    set financialSupportValue(value: boolean) {
        this.$set(this.memberDetails, "requiresFinancialSupport", BooleanStatus.create({ value }))
    }

    get financialSupportChangeDate() {
        return this.memberDetails.requiresFinancialSupport?.date
    }


    get dataPermissionsSettings(): DataPermissionsSettings {
        return OrganizationManager.organization.meta.recordsConfiguration.dataPermission ?? DataPermissionsSettings.create({})
    }

    get dataPermissionsEnabled() {
        return OrganizationManager.organization.meta.recordsConfiguration.dataPermission !== null
    }

    get dataPermissionsTitle() {
        return this.dataPermissionsSettings.title || DataPermissionsSettings.defaultTitle
    }

    get dataPermissionsLabel() {
        return this.dataPermissionsSettings.checkboxLabel || DataPermissionsSettings.defaultCheckboxLabel
    }

    get dataPermissionsValue() {
        return this.memberDetails.dataPermissions?.value ?? false
    }

    set dataPermissionsValue(value: boolean) {
        this.$set(this.memberDetails, "dataPermissions", BooleanStatus.create({ value }))
    }

    get dataPermissionsChangeDate() {
        return this.memberDetails.dataPermissions?.date
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    async save() {
        if (this.loading) {
            return;
        }
        
        const isValid = await this.validator.validate()
        if (!isValid) {
            return;
        }

        if (!this.memberDetails) {
            return false;
        }

        if (!this.member) {
            this.show(new ComponentWithProperties(EditMemberGroupView, {
                memberDetails: this.memberDetails,
                familyManager: this.familyManager,
            }))
            return;
        }

        const o = this.member?.details
        this.loading = true
        
        try {
            if (this.member) {
                this.member.details.set(this.memberDetails)
                // If saving fails, keep changes
                this.forceChange = true
                await this.familyManager.patchAllMembersWith(this.member)
                this.forceChange = false
            }
          
            this.errorBox = null
            this.loading = false;
            this.pop({ force: true })

            // Mark review moment
            AppManager.shared.markReviewMoment()
            return true
        } catch (e) {
            if (this.member && o) {
                this.member.details = o
            }
            this.errorBox = new ErrorBox(e)
            this.loading = false;
            return false;
        }
    }

    get recordCategories(): RecordCategory[] {
        return this.filterRecordCategories(OrganizationManager.organization.meta.recordsConfiguration.recordCategories)
    }

    getCategoryFillStatus(category: RecordCategory) {
        // Check all the properties in this category and check their last review times
        const records = category.getAllFilteredRecords(
            new MemberDetailsWithGroups(this.memberDetails, this.member ?? undefined, []), 
            MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member: this.member ?? undefined}),
            this.dataPermissionsValue
        )

        let hasValue = false
        let hasMissingValue = false

        for (const record of records) {
            const answer = this.memberDetails.recordAnswers.find(a => a.settings.id === record.id)
            if (answer) {
                hasValue = true
            } else {
                hasMissingValue = true
            }
        }

        if (hasValue && hasMissingValue) {
            return "Onvolledig: sommige antwoorden ontbreken"
        }

        if (hasValue && !hasMissingValue) {
            return ""
        }

        return "Niet ingevuld"
    }

    filterRecordCategories(categories: RecordCategory[]): RecordCategory[] {
        return RecordCategory.filterCategories(
            categories, 
            new MemberDetailsWithGroups(this.memberDetails, this.member ?? undefined, []),
            MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member: this.member ?? undefined}),
            this.dataPermissionsValue
        )
    }

    editRecordCategory(category: RecordCategory) {
        const displayedComponent = new ComponentWithProperties(FillRecordCategoryView, {
            category,
            answers: this.memberDetails.recordAnswers,
            dataPermission: this.dataPermissionsValue,
            filterValue: new MemberDetailsWithGroups(this.memberDetails, this.member ?? undefined, []),
            filterDefinitions: MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member: this.member ?? undefined}),
            markReviewed: false,
            saveHandler: (answers: RecordAnswer[], component: NavigationMixin) => {
                this.memberDetails.recordAnswers = answers
                component.dismiss({ force: true })
            }
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    forceChange = false

    get isChanged() {
        if (this.forceChange) {
            return true
        }
        const compareTo = this.member ? this.member.details : MemberDetails.create({})
        if (JSON.stringify(this.memberDetails.encode({ version: Version })) == JSON.stringify(compareTo.encode({ version: Version }))) {
            return false
        }
        return true
    }

    async shouldNavigateAway() {
        if (!this.isChanged) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>