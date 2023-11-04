<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsperiode beëindigen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 v-if="!undo">
                Inschrijvingsperiode beëindigen en een nieuwe periode starten
            </h1>
            <h1 v-else>
                Nieuwe inschrijvingsperiode ongedaan maken
            </h1>

            <template v-if="!undo">
                <p>Stamhoofd werkt met inschrijvingsperiodes: aan het einde van jouw werkjaar, semester, kwartaal, week, wat dan ook, kan je jouw inschrijvingsperiode beëindigen en een nieuwe starten. Je kiest zelf in welke intervallen je werkt, en bij elke inschrijvingsgroep kan je onafhankelijk van elkaar naar een nieuwe inschrijvingsperiode gaan. Alle leden die op dat moment zijn ingeschreven verhuizen dan naar de vorige inschrijvingsperiode en zijn in principe niet langer ingeschreven. Je kan dan wel nog steeds aan alle gegevens van die leden. Je kan leden dus herinneren om zeker in te schrijven voor de nieuwe inschrijvingsperiode.</p>

                <p class="style-description">
                    Het is aan te raden om leden niet gewoon uit te schrijven of te verwijderen, want op die manier kan je niet langer gebruik maken van handige functies in Stamhoofd. Zo kan je bijvoorbeeld inschrijvingen per groep beperken tot leden die de vorige inschrijvingsperiode al ingeschreven waren, of kan je met voorinschrijvingen werken: leden die de vorige inschrijvingsperiode al waren ingeschreven kunnen al sneller beginnen met inschrijven. Je kan ook voorrang geven aan bestaande leden in wachtlijsten. Om dat te laten werken moeten die leden dus ook nog in het systeem zitten bij de vorige inschrijvingsperiode.
                </p>

                <p class="info-box">
                    Kies hieronder voor welke inschrijvingsgroepen je een nieuwe inschrijvingsperiode wilt starten.
                </p>
            </template>

            <template v-else>
                <p>Er werd een nieuwe inschrijvingsperiode gestart voor bepaalde inschrijvingsgroepen. Aangezien er nog geen leden zijn ingeschreven in de nieuwe periode, kan je de nieuwe periode nog ongedaan maken en terug schakelen naar de vorige inschrijvingsperiode.</p>
                
                <p class="info-box">
                    Kies hieronder voor welke inschrijvingsgroepen je terug wilt naar de vorige inschrijvingsperiode
                </p>
            </template>

            <STErrorsDefault :error-box="errorBox" />

            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Checkbox slot="left" :checked="getSelectedGroup(group)" @change="setSelectedGroup(group, $event)" />
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <LoadingButton :loading="saving">
                    <button v-if="!undo" class="button primary" @click="save">
                        Nieuwe inschrijvingsperiode
                    </button>
                    <button v-else class="button primary" @click="save">
                        Vorige inschrijvingsperiode
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Group, GroupSettings, Organization } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        LoadingButton,
        BackButton,
        STList,
        STListItem,
        Checkbox
    },
})
export default class EndRegistrationPeriodView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    saving = false

    @Prop({ required: true })
        initialGroupIds!: string[]

    @Prop({ required: false, default: false })
        undo!: boolean

    groupIds = this.initialGroupIds.slice()

    get categoryTree() {
        if (this.undo) {
            return OrganizationManager.organization.getCategoryTree({maxDepth: 1, admin: true}).filter(g => g.cycle > 0)
        }
        return OrganizationManager.organization.getCategoryTree({maxDepth: 1, admin: true})
    }

    getSelectedGroup(group: Group): boolean {
        return this.groupIds.includes(group.id)
    }

    setSelectedGroup(group: Group, selected: boolean) {
        if (selected) {
            if (this.getSelectedGroup(group) === selected) {
                return
            }
            this.groupIds.push(group.id)
        } else {
            const index = this.groupIds.findIndex(id => id === group.id)
            if (index !== -1) {
                this.groupIds.splice(index, 1)
            }
        }
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true
        this.errorBox = null

        try {
            const p = Organization.patch({
                id: OrganizationManager.organization.id
            })

            const now = new Date()
            const nowFuture = new Date()
            nowFuture.setTime(nowFuture.getTime() + 3 * 1000 * 60 * 60 * 24 * 30)

            for (const id of this.groupIds) {
                const group = OrganizationManager.organization.groups.find(g => g.id === id)
                if (!group) {
                    // Skip this error: probably an invalid group ID in a category which was caused by deleting a group directly
                    continue
                }

                const settings = GroupSettings.patch({})

                const pp = Group.patch({
                    id,
                    cycle: !this.undo ? (group.cycle + 1) : (group.cycle - 1),
                    settings
                })
                p.groups.addPatch(pp)
            }
            
            await OrganizationManager.patch(p)
            this.pop({ force: true })

            MemberManager.callListeners("changedGroup", null)

            new Toast("Vergeet niet om ook de inschrijvingsdatums aan te passen.", "warning yellow").show()
        } catch (e) {
            console.log(e)
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    cancel() {
        this.pop()
    }

}
</script>