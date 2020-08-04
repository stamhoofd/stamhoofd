<template>
    <div v-if="groups.length == 0" id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <h1>
                Er zijn geen beschikbare groepen voor {{ memberDetails.firstName }}
            </h1>
            <p>{{ member.firstName }} is waarschijnlijk te oud of te jong</p>

            <p class="error-box">
                Het is niet mogelijk om {{ memberDetails.firstName }} in te schrijven
            </p>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="pop">
                Sluiten
            </button>
        </STToolbar>
    </div>

    <div v-else id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <h1>
                Bij welke groep wil je {{ memberDetails.firstName }} inschrijven?
            </h1>
            <p>Dit kan later gewijzigd worden indien nodig.</p>
            
            <STList>
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center" @click="selectGroup(group)">
                    <Radio slot="left" name="choose-group" v-model="selectedGroup" :value="group" :disabled="shouldAskExisting(group)"/>
                    <h2 class="style-title-list">{{ group.settings.name }}</h2>
                    <p class="style-description-small" v-if="group.settings.description">{{ group.settings.description }}</p>
                    <span v-if="group.activePreRegistrationDate" class="pre-registrations-label warn" slot="right">Voorinschrijvingen</span>
                    <span v-else-if="group.settings.waitingListType != 'None'" class="pre-registrations-label" slot="right">Wachtlijst</span>
                </STListItem>
            </STList>

            <p class="warning-box" v-if="isWaitingList">Je komt op de wachtlijst van deze groep omdat het aantal leden gelimiteerd is. Je ontvangt een e-mail zodra je kan inschrijven. Dit wil niet zeggen dat deze groep al volzet is.</p>
            <p class="info-box" v-else-if="isSkippingWaitingList">Bestaande leden komen niet op de wachtlijst terecht en kunnen meteen inschrijven</p>

            
            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <Spinner slot="right" v-if="loading" />
            <button  slot="right" class="button primary" @click="goNext">
                Volgende
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STNavigationBar, STToolbar, Radio, STList, STListItem, Spinner, BackButton } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group, MemberWithRegistrations, WaitingListType, PreferredGroup } from "@stamhoofd/structures"
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
        Spinner,
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

    // Set if you know if this is an existing member or a new one
    cachedIsExistingMember: boolean | null = null

    errorBox: ErrorBox | null = null

    // Fow now we only allow to select one group
    selectedGroup: Group | null = this.groups[0] ?? null

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        const preferred = this.memberDetails.getPreferredGroups(this.groups)[0] ?? null
        this.$set(this, "selectedGroup", preferred)

        if (preferred) {
            if (preferred.shouldKnowExisting() && this.memberDetails.doesPreferGroup(preferred, false)) {
                // not on waiting list
                this.cachedIsExistingMember = true
            } else {
                if (preferred.shouldKnowExisting()) {
                    this.cachedIsExistingMember = false
                }
            }
        }
    }

    get groups() {
        const organizization = OrganizationManager.organization
        return this.memberDetails.getMatchingGroups(organizization.groups)
    }

    get isExistingMember(): boolean | null {
        if (this.cachedIsExistingMember !== null) {
            return this.cachedIsExistingMember
        }
        if (this.member && this.member.registrations.length > 0) {
            return true;
        }

        // todo: we could check if group cycle > 0 and return false
        return null;
    }

    /**
     * Return false if popup is needed before selecting it
     */
    shouldAskExisting(group: Group): boolean {
        if (this.isExistingMember !== null) {
            return false
        }
        return group.shouldKnowExisting()
    }

    get isWaitingList() {
        if (!this.selectedGroup) {
            return false
        }
        return this.selectedGroup.isWaitingList(this.isExistingMember ?? false)
    }

    get isSkippingWaitingList() {
        if (!this.selectedGroup) {
            return false
        }

        return !this.isWaitingList && this.selectedGroup.isWaitingList(false)
    }

    selectGroup(group: Group) {
        // todo: check if we need to ask if the member already exists
        if (this.shouldAskExisting(group)) {
            this.present(new ComponentWithProperties(MemberExistingQuestionView, {
                member: this.memberDetails,
                handler: (existingMember: boolean, component) => {
                    this.cachedIsExistingMember = existingMember
                    component.pop({ force: true});
                    this.selectGroup(group)
                }
            }).setDisplayStyle("sheet"))
            //this.cachedIsExistingMember = false
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

        try {
            this.selectedGroup.canRegisterInGroup(this.isExistingMember ?? false)
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
            groupId: this.selectedGroup.id,
            waitingList: this.selectedGroup.isWaitingList(this.isExistingMember ?? false),
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
