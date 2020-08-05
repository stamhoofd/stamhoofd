<template>
    <div v-if="groups.length == 0" id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <h1>
                Er zijn geen beschikbare groepen voor {{ memberDetails.firstName }}
            </h1>
            <p>{{memberDetails.firstName }} is waarschijnlijk te oud of te jong</p>

            <p class="error-box">
                Het is niet mogelijk om {{ memberDetails.firstName }} in te schrijven
            </p>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="dismiss">
                Sluiten
            </button>
        </STToolbar>
    </div>

    <div v-else id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <template v-if="groups.length > 1">
                <h1>
                    Bij welke groep wil je {{ memberDetails.firstName }} inschrijven?
                </h1>
                <p>Dit kan later gewijzigd worden indien nodig.</p>
            </template>
            <template v-else>
                <h1 v-for="group in groups" :key="group.id">
                    {{ memberDetails.firstName }} inschrijven bij {{ group.settings.name }}
                    <span v-if="group.activePreRegistrationDate" class="pre-registrations-label warn" slot="right">Voorinschrijvingen</span>
                    <span v-else-if="group.settings.waitingListType != 'None'" class="pre-registrations-label" slot="right">Wachtlijst</span>
                </h1>
                <p v-if="groups[0].settings.description">{{ groups[0].settings.description }}</p>
            </template>
            
            <STList v-if="groups.length > 1">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center" @click="selectGroup(group)">
                    <Radio slot="left" name="choose-group" v-model="selectedGroup" :value="group" :disabled="shouldAskExisting(group)"/>
                    <h2 class="style-title-list">{{ group.settings.name }}</h2>
                    <p class="style-description-small" v-if="group.settings.description">{{ group.settings.description }}</p>
                    <span v-if="group.activePreRegistrationDate" class="pre-registrations-label warn" slot="right">Voorinschrijvingen</span>
                    <span v-else-if="group.settings.waitingListType != 'None'" class="pre-registrations-label" slot="right">Wachtlijst</span>
                </STListItem>
            </STList>

            <p class="warning-box" v-if="isWaitingList">Je komt op de wachtlijst van deze groep omdat het aantal leden gelimiteerd is. Je ontvangt een e-mail zodra je kan inschrijven. Dit wil niet zeggen dat deze groep al volzet is.</p>
            <p class="info-box" v-else-if="isSkippingWaitingList">
                <template v-if="selectedGroup.settings.priorityForFamily">
                    Bestaande leden en hun broers/zussen komen niet op de wachtlijst terecht en kunnen meteen inschrijven
                </template>
                <template v-else>
                    Bestaande leden komen niet op de wachtlijst terecht en kunnen meteen inschrijven
                </template>
            </p>
            
            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="goNext">
                    {{ isWaitingList ? 'Op wachtlijst zetten' : 'Volgende' }}
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STNavigationBar, STToolbar, Radio, STList, STListItem, LoadingButton, BackButton } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group, MemberWithRegistrations, WaitingListType, PreferredGroup, MemberExistingStatus } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';
import { Formatter } from '@stamhoofd/utility';
import MemberExistingQuestionView from './MemberExistingQuestionView.vue';

/**
 * Gets and sets the preferred groups of a member
 */
@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        Radio,
        STList,
        STListItem,
        LoadingButton,
        BackButton
    }
})
export default class MemberGroupView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    member: MemberWithRegistrations | null

    @Prop({ required: true })
    memberDetails: MemberDetails

    @Prop({ required: true })
    handler: (component: MemberGroupView) => void;

    errorBox: ErrorBox | null = null

    // Fow now we only allow to select one group
    selectedGroup: Group | null = null

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        // Automatically fill in member existing status if not set or expired
        if ((this.memberDetails.existingStatus === null || this.memberDetails.existingStatus.isExpired())) {
            this.memberDetails.existingStatus = null;

            if (this.member && this.member.inactiveRegistrations.length > 0) {
                // Are these registrations active?
                this.memberDetails.existingStatus = MemberExistingStatus.create({
                    isNew: false,
                    hasFamily: false, // unknown (doesn't matter atm if not new)
                })
            }
        }


        const preferred = this.memberDetails.getPreferredGroups(this.groups)[0] ?? null

        if (preferred.shouldKnowExisting() && this.memberDetails.existingStatus === null) {
            // For some reason we didn't ask the existing status (or it became invalid)
            this.$set(this, "selectedGroup", null)
        } else {
            this.$set(this, "selectedGroup", preferred)
        }
    }

    get groups() {
        const organizization = OrganizationManager.organization
        return this.memberDetails.getMatchingGroups(organizization.groups)
    }

    /**
     * Return false if popup is needed before selecting a group
     */
    shouldAskExisting(group: Group): boolean {
        if (this.memberDetails.existingStatus !== null) {
            return false
        }
        return group.shouldKnowExisting()
    }

    /**
     * Return true if the current selected group has a waiting list, and the member will get added to that waiting list
     */
    get isWaitingList() {
        if (!this.selectedGroup) {
            return false
        }
        return this.selectedGroup.isWaitingList(this.memberDetails.existingStatus)
    }

    /**
     * Return true if the selected group has a waiting list, but he won't get added to it
     */
    get isSkippingWaitingList() {
        if (!this.selectedGroup) {
            return false
        }

        return !this.isWaitingList && this.selectedGroup.isWaitingList(MemberExistingStatus.create({
            isNew: true,
            hasFamily: false
        }))
    }

    selectGroup(group: Group) {
        // todo: check if we need to ask if the member already exists
        if (this.shouldAskExisting(group)) {
            this.present(new ComponentWithProperties(MemberExistingQuestionView, {
                member: this.memberDetails,
                handler: (component) => {
                    component.pop({ force: true});
                    this.selectGroup(group)
                }
            }).setDisplayStyle("sheet"))
        } else {
            this.$set(this, "selectedGroup", group)
        }

        setTimeout(() => {
            this.validateGroup()
        }, 100)
    }

    validateGroup(final: boolean = false): boolean {
        this.errorBox = null

        if (!this.selectedGroup) {
            if (final) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: "",
                    message: "Maak een keuze voor je verder gaat"
                }))
            }
            return false
        }

        if (this.shouldAskExisting(this.selectedGroup)) {
            if (final) {
                // Trigger popup
                this.selectGroup(this.selectedGroup)
            }
            return false
        }

        try {
            this.selectedGroup.canRegisterInGroup(this.memberDetails.existingStatus)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            return false
        }
        return true
    }

    async goNext() {
        if (this.loading) {
            return;
        }
        
        if (!this.selectedGroup) {
            if (this.groups.length == 1) {
                this.selectGroup(this.groups[0])
                return
            }

            this.errorBox = new ErrorBox(new SimpleError({
                code: "not_selected",
                message: "Kies een groep voor je verder gaat"
            }))
            return;
        }
        this.errorBox = null
        if (this.validateGroup(true) == false) {
            return;
        }

        this.memberDetails.preferredGroups = [PreferredGroup.create({
            groupId: this.selectedGroup.id,
            waitingList: this.selectedGroup.isWaitingList(this.memberDetails.existingStatus),
            cycle: this.selectedGroup.cycle
        })]

        this.handler(this)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#group-selection-view {
    .pre-registrations-label {
        @extend .style-tag;
    }
}
</style>
