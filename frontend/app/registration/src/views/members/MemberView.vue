<template>
    <div class="st-view">
        <STNavigationBar :title="member.name">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop"/>
            </template>
            <button slot="right" v-if="!canPop && canDismiss" class="button icon close gray" @click="dismiss"/>
        </STNavigationBar>
        
        <main>
            <h1>{{ member.name }}</h1>

            <p class="warning-box" v-if="false">
                De persoonlijke gegevens van dit lid zijn versleuteld (zie onder) en momenteel (voor jou) onleesbaar. Dit komt omdat je een nieuw account hebt aangemaakt of omdat je jouw wachtwoord was vergeten. Je kan de gegevens momenteel niet nakijken, maar je ontvangt een mailtje zodra we jou manueel toegang hebben gegeven. Je kan nu ook gewoon alles opnieuw ingeven als je niet wilt wachten.
            </p>

            <div class="hover-box container">
                <h2 class="style-with-button">
                    <div>Algemeen</div>
                    <div class="hover-show">
                        <button class="button icon gray edit" @click="editGeneral()" />
                    </div>
                </h2>
                <dl class="details-grid">
                    <template v-if="member.details.memberNumber">
                        <dt>Lidnummer</dt>
                        <dd>{{ member.details.memberNumber }}</dd>
                    </template>

                    <template v-if="member.details.birthDay">
                        <dt>Verjaardag</dt>
                        <dd>{{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)</dd>
                    </template>

                    <template v-if="member.waitingGroups.length > 0">
                        <dt>Wachtlijst</dt>
                        <dd>{{ member.waitingGroups.map(g => g.settings.name).join(", ") }}</dd>
                    </template>

                    <template v-if="member.details.phone">
                        <dt>GSM-nummer</dt>
                        <dd>{{ member.details.phone }}</dd>
                    </template>

                    <template v-if="member.details.email">
                        <dt>E-mailadres</dt>
                        <dd>{{ member.details.email }}</dd>
                    </template>

                    <template v-if="member.details.address">
                        <dt>Adres</dt>
                        <dd>
                            {{ member.details.address.street }} {{ member.details.address.number }}<br>{{ member.details.address.postalCode }}
                            {{ member.details.address.city }}
                        </dd>
                    </template>
                </dl>
            </div>

            <div class="container" v-if="parents.length > 0">
                <hr>
                <h2 class="style-with-button">
                    <div>Ouders</div>
                    <div>
                        <button class="button text limit-space" @click.stop="editGeneral()">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                    </div>
                </h2>
                <STList>
                    <STListItem v-for="parent in parents" :key="parent.id" :selectable="true" element-name="label" @click.stop="editParent(parent)">
                        <h2 class="style-title-list">{{ parent.firstName }} {{ parent.lastName }}</h2>
                        <p class="style-description-small" v-if="parent.phone">{{ parent.phone }}</p>
                        <p class="style-description-small" v-if="parent.email">{{ parent.email }}</p>
                        <p class="style-description-small" v-if="parent.address">{{ parent.address }}</p>

                        <span slot="right" class="icon arrow-right gray" />
                    </STListItem>
                </STList>
            </div>

            <hr>
            <h2>Hoe worden deze gegevens bewaard?</h2>

            <p>Om de gegevens van onze leden te beschermen, worden deze end-to-end versleuteld opgeslagen. We plaatsen ze dus in een kluis, waar het computersysteem niet in kan. Normaal heb je toegang tot de sleutel van deze kluis, maar je kan deze kwijt geraken als: je jouw wachtwoord vergeet of een nieuw account aanmaakt. We kunnen deze sleutel terug met jou delen, op voorwaarde dat je een account hebt met een wachtwoord dat je kent. Dus zodra je een nieuw wachtwoord hebt gekozen, krijgen wij een melding en kunnen wij op een wiskundig veilige manier de sleutel bij jou brengen zonder dat het computersysteem deze kan lezen. Beetje ingewikkeld, maar op die manier zijn de gegevens van onze leden zo veilig mogelijk opgeslagen.</p>

        </main>

        <STToolbar>
            <button slot="right" class="primary button" @click="chooseGroups">
                <span class="icon add" />
                <span>Inschrijven</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, BackButton } from "@stamhoofd/components"
import { MemberWithRegistrations, Parent } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";
//import MemberGeneralView from "../registration/MemberGeneralView.vue";
import GroupTree from "../../components/GroupTree.vue";
import MemberChooseGroupsView from "./MemberChooseGroupsView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        GroupTree
    },
    filters: {
        price: Formatter.price
    }
})
export default class MemberView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    member!: MemberWithRegistrations

    editGeneral() {
        /*this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                initialMember: this.member,
                editOnly: true
            })
        }).setDisplayStyle("popup"))*/
    }

    get parents() {
        return this.member.details?.parents ?? []
    }

    chooseGroups() {
        this.show(new ComponentWithProperties(MemberChooseGroupsView, {
            member: this.member
        }))
    }

    editParent(parent: Parent) {
        /*this.present(new ComponentWithProperties(ParentView, {
            memberDetails: this.member.details,
            parent,
            handler: (parent: Parent, component: ParentView) => {
                component.pop({ force: true })
                // todo! SAVE HERE!
                //this.checkNewParents()
            }
        }).setDisplayStyle("popup"))*/
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>