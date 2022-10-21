<template>
    <div id="member-parents-view" class="st-view">
        <STNavigationBar title="Ouders">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1>
                Ouders van {{ details.firstName }}
            </h1>

            <p v-if="details.age <= 18">
                Voeg alle ouders van {{ details.firstName }} toe. Deze kunnen we contacteren in noodgevallen, maar krijgen ook toegang tot het ledenportaal.
            </p>
            <p v-else>
                Voeg alle ouders van {{ details.firstName }} toe. Deze kunnen we contacteren in noodgevallen.
            </p>

            <p v-if="parents.length == 0" class="warning-box">
                Voeg alle ouders toe met de knop onderaan.
            </p>
            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="parent in parents" :key="parent.parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                    <Checkbox slot="left" v-model="parent.selected" @change="onChangedSelection" />

                    <h2 class="parent-name">
                        {{ parent.parent.firstName }} {{ parent.parent.lastName }}
                    </h2>
                    <p v-if="parent.parent.phone" class="parent-description">
                        {{ parent.parent.phone }}
                    </p>
                    <p v-if="parent.parent.email" class="parent-description">
                        {{ parent.parent.email }}
                    </p>
                    <p v-if="parent.parent.address" class="parent-description">
                        {{ parent.parent.address }}
                    </p>

                    <button slot="right" class="button text limit-space" @click.stop="editParent(parent.parent)">
                        <span class="icon edit" />
                        <span>Bewerken</span>
                    </button>
                </STListItem>
            </STList>

            <!-- todo: add checkboxes and parents of other members that are already known -->
        </main>
        <STToolbar>
            <button slot="right" class="button" :class="{ primary: parents.length <= 1, secundary: parents.length > 1}" @click="addParent">
                <span class="icon add" />
                <span>Ouder toevoegen</span>
            </button>
            <!-- Next buttons becomes primary button when two parents are selected. We know lot's of members will only have one parent, but we need to force parents to add both parents if they have two parents -->
            <button slot="right" class="button" :class="{ secundary: parents.length <= 1, primary: parents.length > 1}" @click="goNext">
                {{ nextText }}
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage,Checkbox, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, Parent, RegisterItem, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import ParentView from './ParentView.vue';

class SelectableParent {
    selected = false
    parent: Parent

    constructor(parent: Parent, selected = false) {
        this.selected = selected
        this.parent = parent
    }
}

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem,
        Checkbox,
        BackButton
    }
})
export default class EditMemberParentsView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    isNew: boolean

    @Prop({ required: false })
    member?: MemberWithRegistrations

    @Prop({ required: true })
    items: RegisterItem[]

    @Prop({ required: true })
    details: MemberDetails

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    errorBox: ErrorBox | null = null
    parents: SelectableParent[] = []

    get isOptional() {
        return !OrganizationManager.organization.meta.recordsConfiguration.parents?.requiredWhen?.doesMatch(new MemberDetailsWithGroups(this.details, this.member, this.items))
    }

    editParent(parent: Parent) {
        this.present(new ComponentWithProperties(ParentView, {
            memberDetails: this.details,
            parent,
            handler: (parent: Parent, component: NavigationMixin) => {
                component.pop({ force: true })
                this.checkNewParents()
            }
        }).setDisplayStyle("popup"))
    }

    addParent() {
        this.errorBox = null;
        this.present(new ComponentWithProperties(ParentView, {
            memberDetails: this.details,
            handler: (parent: Parent, component: NavigationMixin) => {
                this.details.parents.push(parent)
                this.checkNewParents()
                component.pop({ force: true })
            }
        }).setDisplayStyle("popup"))
    }

    mounted() {
        // Read parents from details
        for (const parent of this.details.parents) {
            this.parents.push(new SelectableParent(parent, true))
        }

        const autoSelect = this.parents.length == 0

        // Read parents from membermanager
        for (const parent of MemberManager.getParents()) {
            if (!this.parents.find(p => p.parent.id == parent.id)) {
                this.parents.push(new SelectableParent(parent, autoSelect))
            }
        }
        this.onChangedSelection()
    }

    onChangedSelection() {
        this.details.parents = this.parents.flatMap(p => {
            if (p.selected) {
                return [p.parent]
            }
            return []
        })
    }

    checkNewParents() {
        // Only check for new parents!
        for (const parent of this.details.parents) {
            if (!this.parents.find(p => p.parent.id == parent.id)) {
                this.parents.push(new SelectableParent(parent, true))
            }
        }
    }

    activated() {
        // Only check for new parents!
        this.checkNewParents()
    }

    @Prop({ required: true })
    nextText: string

    @Prop({ required: true })
    originalDetails: MemberDetails

    async shouldNavigateAway() {
        if (
            JSON.stringify(this.details.encode({ version: Version })) == JSON.stringify(this.originalDetails.encode({ version: Version }))
        ) {
            // Nothing changed
            return true
        }
        if (await CenteredMessage.confirm("Ben je zeker dat je dit venster wilt sluiten zonder op te slaan?", "Sluiten")) {
            return true;
        }
        return false;
    }

    get selectionCount() {
        return this.parents.reduce((a, p) => { return a + (p.selected ? 1 : 0) }, 0)
    }

    async skipStep() {
        if (this.loading) {
            return;
        }
        this.details.parents = []
        this.errorBox = null;
        this.loading = true

        try {
            this.details.reviewTimes.markReviewed("parents")
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
    
    async goNext() {
        if (!this.isOptional && this.details.parents.length == 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Voeg alle ouders toe voor je verder gaat"
            }))
            return;
        }

        this.errorBox = null;
        this.loading = true

        try {
            this.details.reviewTimes.markReviewed("parents")
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#member-parents-view {
    .parent-name + .parent-description {
        padding-top: 5px;
    }
    .parent-description {
        @extend .style-description-small;
    }
}
</style>
