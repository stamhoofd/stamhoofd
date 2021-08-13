<template>
    <div id="edit-member-contacts-view" class="view">
        <main>
            <h2 class="style-with-button">
                <span>Ouders</span>
                <div>
                    <button type="button" class="button text" @click="addParent">
                        <span class="icon add" />
                        <span>Toevoegen</span>
                    </button>
                </div>
            </h2>
            
            <STErrorsDefault :error-box="errorBox" />

            <STList v-if="parents.length > 0">
                <STListItem v-for="parent in parents" :key="parent.parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                    <Checkbox slot="left" v-model="parent.selected" @change="onChangedSelection" />

                    <h2 class="style-title-list">
                        {{ parent.parent.firstName }} {{ parent.parent.lastName }}
                    </h2>
                    <p v-if="parent.parent.phone" class="style-description-small">
                        {{ parent.parent.phone }}
                    </p>
                    <p v-if="parent.parent.email" class="style-description-small">
                        {{ parent.parent.email }}
                    </p>
                    <p v-if="parent.parent.address" class="style-description-small">
                        {{ parent.parent.address }}
                    </p>

                    <button slot="right" class="button text limit-space" @click.stop="editParent(parent)">
                        <span class="icon edit" />
                        <span>Bewerken</span>
                    </button>
                </STListItem>
            </STList>

            <p v-else class="info-box">
                Er zijn geen ouders ingesteld bij dit lid
            </p>

            <template v-if="isNotAsked">
                <hr>
                <h2 :class="{ 'style-with-button': emergencyContacts.length == 0}">
                    <span>Noodcontact</span>
                    <div v-if="emergencyContacts.length == 0">
                        <button type="button" class="button text" @click="addEmergencyContact">
                            <span class="icon add" />
                            <span>Toevoegen</span>
                        </button>
                    </div>
                </h2>

                <STList v-if="emergencyContacts.length > 0">
                    <STListItem v-for="contact in emergencyContacts" :key="contact.id" :selectable="true" element-name="label" class="right-stack">
                        <h2 class="style-title-list">
                            {{ contact.name }} ({{ contact.title }})
                        </h2>
                        <p v-if="contact.phone" class="style-description-small">
                            {{ contact.phone }}
                        </p>

                        <button slot="right" class="button text limit-space" @click.stop="editEmergencyContact()">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                    </STListItem>
                </STList>

                <p v-else class="info-box">
                    Er is geen noodcontact ingesteld bij dit lid
                </p>
            </template> 
            
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ErrorBox, LoadingButton,Slider, STErrorsDefault, STInputBox, STList, STListItem, STToolbar } from "@stamhoofd/components"
import { EmergencyContact, MemberWithRegistrations, Parent,Version } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import { FamilyManager } from '../../../../classes/FamilyManager';
import EditMemberEmergencyContactView from './EditMemberEmergencyContactView.vue';
import EditMemberParentView from './EditMemberParentView.vue';

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
        Slider,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem,
        STToolbar,
        Checkbox,
        LoadingButton
    },
    model: {
        prop: 'memberDetails',
        event: 'change'
    },
})
export default class EditMemberContactsView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    member!: MemberWithRegistrations | null     

    @Prop({ default: null })
    memberDetails!: MemberDetails | null      

    @Prop({ required: true })
    familyManager: FamilyManager
        
    errorBox: ErrorBox | null = null

    cachedParents: SelectableParent[] | null = null

    editParent(selectable: SelectableParent) {
        // Make sure we select it (else we risk losing it if we return)
        selectable.selected = true
        this.onChangedSelection()
        const parent = selectable.parent
        this.present(new ComponentWithProperties(EditMemberParentView, {
            memberDetails: this.memberDetails,
            familyManager: this.familyManager,
            parent,
            handler: (parent: Parent, component: EditMemberParentView) => {
                if (!this.memberDetails) {
                    return;
                }

                const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
                this.$emit("change", memberDetails)
                this.cachedParents = null
                component.pop({ force: true })
            }
        }).setDisplayStyle("popup"))
    }

    addEmergencyContact() {
        this.editEmergencyContact()
    }

    editEmergencyContact() {
        this.present(new ComponentWithProperties(EditMemberEmergencyContactView, {
            familyManager: this.familyManager,
            contact: this.memberDetails?.emergencyContacts[0] ?? null,
            handler: (contact: EmergencyContact, component: EditMemberEmergencyContactView) => {
                if (!this.memberDetails) {
                    return;
                }

                const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
                memberDetails.emergencyContacts = [contact]
                this.$emit("change", memberDetails)

                component.pop({ force: true })
            }
        }).setDisplayStyle("popup"))
    }

    addParent() {
        this.present(new ComponentWithProperties(EditMemberParentView, {
            memberDetails: this.memberDetails,
            familyManager: this.familyManager,
            handler: (parent: Parent, component: EditMemberParentView) => {
                if (!this.memberDetails) {
                    return;
                }
                const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
                memberDetails.parents.push(parent)
                this.$emit("change", memberDetails)
                this.cachedParents = null
                component.pop({ force: true })
            }
        }).setDisplayStyle("popup"))
    }

    get emergencyContacts(): EmergencyContact[]  {
        return this.memberDetails?.emergencyContacts ?? []
    }
    
    get isNotAsked() {
        return OrganizationManager.organization.meta.recordsConfiguration.emergencyContact === AskRequirement.NotAsked
    }

    get parents(): SelectableParent[]  {
        if (this.cachedParents) {
            return this.cachedParents
        }

        const parents: SelectableParent[] = []
        for (const parent of this.memberDetails?.parents ?? []) {
            parents.push(new SelectableParent(parent, true))
        }

        for (const parent of this.member?.details?.parents ?? []) {
            if (!parents.find(p => p.parent.id == parent.id)) {
                parents.push(new SelectableParent(parent, false))
            }
        }
        
        // Read parents from membermanager
        for (const parent of this.familyManager.getParents()) {
            if (!parents.find(p => p.parent.id == parent.id)) {
                parents.push(new SelectableParent(parent, false))
            }
        }
        this.cachedParents = parents

        return parents
    }

    onChangedSelection() {
        if (!this.memberDetails) {
            return;
        }

        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        memberDetails.parents = this.parents.flatMap(p => {
            if (p.selected) {
                return [p.parent]
            }
            return []
        })
        this.$emit("change", memberDetails)
    }

    get selectionCount() {
        return this.parents.reduce((a, p) => { return a + (p.selected ? 1 : 0) }, 0)
    }
    
    async validate() {
        return true
    }
}
</script>

<style lang="scss">
    #edit-member-contacts-view {
        .style-with-button {
            margin-bottom: 0;
            padding-bottom: 0;
        }
    }
</style>
