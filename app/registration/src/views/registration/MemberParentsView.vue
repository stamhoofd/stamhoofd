<template>
    <div id="member-parents-view" class="st-view">
        <STNavigationBar title="Ouders">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">Terug</button>
        </STNavigationBar>
        
        <main>
            <h1>
                Ouders van {{ member.firstName }}
            </h1>

            <p v-if="member.age <= 18">Voeg alle ouders van {{ member.firstName }} toe. Deze kunnen we contacteren in noodgevallen, maar kunnen ook de gegevens tijdens het jaar wijzigen.</p>
            <p v-else>Voeg alle ouders van {{ member.firstName }} toe (of enkel die van de hoofdverblijfplaats). Deze kunnen we contacteren in noodgevallen.</p>

            <p class="warning-box" v-if="parents.length == 0">Voeg alle ouders toe met de knop onderaan.</p>
            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="parent in parents" :key="parent.parent.id" :selectable="true" @click="editParent(parent.parent)" class="right-stack left-center">
                    <Checkbox slot="left" @click.native.stop v-model="parent.selected" @change="onChangedSelection" />

                    <h2 class="parent-name">{{ parent.parent.firstName }} {{ parent.parent.lastName }}</h2>
                    <p class="parent-description" v-if="parent.parent.phone">{{ parent.parent.phone }}</p>

                    <template slot="right">
                        <p class="parent-description" v-if="parent.parent.address">{{ parent.parent.address }}</p>
                        <span class=" icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <!-- todo: add checkboxes and parents of other members that are already known -->
        </main>
        <STToolbar>
            <button slot="right" class="button" :class="{ primary: parents.length <= 1, secundary: parents.length > 1}" @click="addParent">
                <span class="icon white add"/>Ouder toevoegen
            </button>
            <!-- Next buttons becomes primary button when two parents are selected. We know lot's of members will only have one parent, but we need to force parents to add both parents if they have two parents -->
            <button slot="right" class="button" :class="{ secundary: parents.length <= 1, primary: parents.length > 1}" @click="goNext">
                Volgende
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator, STList, STListItem, Checkbox } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import ParentView from './ParentView.vue';
import EmergencyContactView from './EmergencyContactView.vue';
import { EmergencyContact } from '@stamhoofd/structures';
import MemberRecordsView from './MemberRecordsView.vue';
import { MemberManager } from '../../classes/MemberManager';

class SelectableParent {
    selected = false
    parent: Parent

    constructor(parent: Parent, selected: boolean = false) {
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
        Checkbox
    }
})
export default class MemberParentsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails
    errorBox: ErrorBox | null = null

    parents: SelectableParent[] = []

    editParent(parent: Parent) {
        if (this.navigationController) {
            this.navigationController.animationType = "modal"
        }
        this.show(new ComponentWithProperties(ParentView, {
            parent,
            handler: (parent: Parent, component: ParentView) => {
                component.pop()
            }
        }))
    }

    addParent() {
        if (this.navigationController) {
            this.navigationController.animationType = "modal"
        }
        this.show(new ComponentWithProperties(ParentView, {
            handler: (parent: Parent, component: ParentView) => {
                this.member.parents.push(parent)
                component.pop()
            }
        }))
    }

    mounted() {
        // Read parents from member
        for (const parent of this.member.parents) {
            this.parents.push(new SelectableParent(parent, true))
        }

        // Read parents from membermanager
        for (const parent of MemberManager.getParents()) {
            if (!this.parents.find(p => p.parent.id == parent.id)) {
                this.parents.push(new SelectableParent(parent, false))
            }
        }
    }

    onChangedSelection() {
        this.member.parents = this.parents.flatMap(p => {
            if (p.selected) {
                return [p.parent]
            }
            return []
        })
    }

    activated() {
        if (this.navigationController) {
            this.navigationController.animationType = "default"
        }

        // Only check for new parents!
        for (const parent of this.member.parents) {
            if (!this.parents.find(p => p.parent.id == parent.id)) {
                this.parents.push(new SelectableParent(parent, true))
            }
        }
    }

    get selectionCount() {
        return this.parents.reduce((a, p) => { return a + (p.selected ? 1 : 0) }, 0)
    }
    
    async goNext() {
        if (this.member.parents.length == 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Voeg alle ouders toe voor je verder gaat"
            }))
            return;
        }

        // Emergency contact
        this.show(new ComponentWithProperties(EmergencyContactView, { 
            handler: (contact: EmergencyContact, component: EmergencyContactView) => {
                this.member.emergencyContacts = [contact]
                
                // go to the steekkaart view
                component.show(new ComponentWithProperties(MemberRecordsView, { member: this.member }))
            }
        }))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#member-parents-view {
    .parent-description {
        @extend .style-description-small;
    }
}
</style>
