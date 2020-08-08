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
                <h1 v-for="group in groups" :key="group.group.id">
                    {{ memberDetails.firstName }} inschrijven bij {{ group.group.settings.name }}

                    <span v-if="group.group.activePreRegistrationDate" class="pre-registrations-label warn">Voorinschrijvingen</span>
                    <span v-if="group.waitingList !== false" class="pre-registrations-label">Wachtlijst</span>
                </h1>
                <p v-if="groups[0].group.settings.description">{{ groups[0].group.settings.description }}</p>
                <p v-else-if="!isWaitingList">{{ memberDetails.firstName }} zal worden ingeschreven bij {{ groups[0].group.settings.name }}. Klik volgende om verder te gaan.</p>
                <p v-else>{{ memberDetails.firstName }} zal op de wachtlijst komen te staan voor {{ groups[0].group.settings.name }}.</p>
            </template>
            
            <STList v-if="groups.length > 1">
                <STListItem v-for="group in groups" :key="group.group.id" :selectable="true" element-name="label" class="right-stack left-center" @click="selectGroup(group)">
                    <Radio slot="left" name="choose-group" :model-value="selectableGroup" :value="group" :disabled="group.askExistingStatus"/>
                    <h2 class="style-title-list">{{ group.group.settings.name }}</h2>
                    <p class="style-description-small" v-if="group.group.settings.description">{{ group.group.settings.description }}</p>
                    <span v-if="group.preRegistrations" class="pre-registrations-label warn">Voorinschrijvingen</span>
                    <span v-if="group.waitingList" class="pre-registrations-label">Wachtlijst</span>
                </STListItem>
            </STList>

            <template v-if="selectableGroup && selectableGroup.waitingList">
                <p class="warning-box" v-if="!selectableGroup.skipReason">Je komt op de wachtlijst van deze groep omdat het aantal leden gelimiteerd is. Je ontvangt een e-mail zodra je kan inschrijven. Dit wil niet zeggen dat deze groep al volzet is.</p>
                <p class="info-box" v-else-if="selectableGroup.skipReason == 'Family'">
                    Broers/zussen van bestaande leden komen niet op de wachtlijst terecht en kunnen meteen inschrijven
                </p>
                <p class="info-box" v-else-if="selectableGroup.skipReason == 'ExistingMember'">
                    Bestaande leden komen niet op de wachtlijst terecht en kunnen meteen inschrijven
                </p>
                <p class="info-box" v-else-if="selectableGroup.skipReason == 'Invitation'">
                    Je hebt een uitnodiging ontvangen om in te schrijven en kan dus voorbij de wachtlijst
                </p>
            </template>
            
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
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group, MemberWithRegistrations, WaitingListType, PreferredGroup, MemberExistingStatus, SelectableGroup, SelectedGroup } from "@stamhoofd/structures"
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
    @Prop({ required: true })
    member: MemberWithRegistrations

    get memberDetails(): MemberDetails {
        return this.member.details!
    }

    @Prop({ required: true })
    handler: (component: MemberGroupView) => void;

    errorBox: ErrorBox | null = null

    // Fow now we only allow to select one group
    selectedGroup: SelectedGroup | null = null

    groups: SelectableGroup[] = []

    get selectableGroup(): SelectableGroup | null {
        if (!this.selectedGroup) {
            return null
        }
        return this.member.getSelectableGroups(OrganizationManager.organization.groups).find(g => g.group.id == this.selectedGroup!.group.id) ?? null
    }

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        const preferred = this.member?.getSelectedGroups(OrganizationManager.organization.groups)[0] ?? null
        this.$set(this, "selectedGroup", preferred)

        this.updateGroups()

        if (this.groups.length == 1) {
            this.selectGroup(this.groups[0])
            return
        }
    }

    updateGroups() {
        const organizization = OrganizationManager.organization
        this.$set(this, "groups", this.member.getSelectableGroups(organizization.groups))
    }

    /**
     * Return true if the current selected group has a waiting list, and the member will get added to that waiting list
     */
    get isWaitingList() {
        if (!this.selectedGroup) {
            return false
        }
        return this.selectedGroup.waitingList
    }

    selectGroup(group: SelectableGroup) {
        // todo: check if we need to ask if the member already exists
        if (group.askExistingStatus) {
            this.present(new ComponentWithProperties(MemberExistingQuestionView, {
                member: this.memberDetails,
                handler: (component) => {
                    component.pop({ force: true});
                    this.updateGroups()
                    this.selectGroup(this.groups.find(g => g.group.id == group.group.id)!)
                }
            }).setDisplayStyle("sheet"))
        } else {
            this.$set(this, "selectedGroup", new SelectedGroup(group.group, group.waitingList && !group.skipReason))
        }
        this.updateGroups()

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

        if (this.selectableGroup && this.selectableGroup.askExistingStatus) {
            if (final) {
                // Trigger popup
                this.selectGroup(this.selectableGroup)
            }
            return false
        }

        try {
            // tood: invitation
            this.selectedGroup.group.canRegisterInGroup(this.memberDetails.existingStatus)
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
            groupId: this.selectedGroup.group.id,
            waitingList: this.selectedGroup.waitingList,
            cycle: this.selectedGroup.group.cycle
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
