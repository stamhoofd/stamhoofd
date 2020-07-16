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

            <p class="warning-box" v-if="member.parents.length == 0">Voeg alle ouders toe met de knop onderaan.</p>
            <STList>
                <STListItem v-for="parent in member.parents" :key="parent.id" :selectable="true" @click="editParent(parent)" class="right-stack">
                    <Checkbox slot="left" @click.stop />

                    <h2 class="parent-name">{{ parent.firstName }} {{ parent.lastName }}</h2>
                    <p class="parent-description" v-if="parent.phone">{{ parent.phone }}</p>

                    <template slot="right">
                        <p class="parent-description" v-if="parent.address">{{ parent.address }}</p>
                        <span class=" icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <!-- todo: add checkboxes and parents of other members that are already known -->
        </main>
        <STToolbar>
            <button  slot="right" class="button primary" @click="addParent">
                <span class="icon white add"/>Ouder toevoegen
            </button>
            <button  slot="right" class="button secundary" @click="goNext">
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

    editParent(parent: Parent) {
        if (this.navigationController) {
            this.navigationController.animationType = "modal"
        }
        this.show(new ComponentWithProperties(ParentView, {
            parent,
            handler: (parent: Parent) => {
                // todo
                //this.member.parents.push(parent)
            }
        }))
    }

    addParent() {
        if (this.navigationController) {
            this.navigationController.animationType = "modal"
        }
        this.show(new ComponentWithProperties(ParentView, {
            handler: (parent: Parent) => {
                this.member.parents.push(parent)
            }
        }))
    }

    activated() {
        if (this.navigationController) {
            this.navigationController.animationType = "default"
        }
    }

    
    async goNext() {
        if (this.member.parents.length == 0) {
            return;
        }

        // Emergency contact
        this.show(new ComponentWithProperties(EmergencyContactView, { 
            handler: (contact: EmergencyContact) => {
                this.member.emergencyContacts = [contact]
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
