<template>
    <div id="member-general-view" class="st-view">
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
                <STListItem v-for="parent in member.parents" :key="parent.id" :selectable="true" @click="editParent(parent)">
                    {{ parent.firstName }} {{ parent.lastName }}
                </STListItem>
            </STList>
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
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator, STList, STListItem } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import ParentView from './ParentView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem
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
        // todo
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#member-parents-view {
}
</style>
