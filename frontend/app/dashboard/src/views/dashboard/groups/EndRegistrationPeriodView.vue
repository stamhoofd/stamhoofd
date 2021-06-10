<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsperiode beïndigen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button v-if="!canPop" class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                Inschrijvingsperiode beïndigen en een nieuwe periode starten
            </h1>
            
            <p>Stamhoofd werkt met inschrijvingsperiodes: aan het einde van jouw werkjaar, semester, kwartaal, week... kan je jouw inschrijvingsperiode beïndigen en een nieuwe starten. Je kiest zelf in welke intervallen je werkt, en bij elke inschrijvingsgroep kan je onafhankelijk van elkaar naar een nieuwe inschrijvingsperiode gaan. Alle leden die op dat moment zijn ingeschreven verhuizen dan naar de vorige inschrijvingsperiode en zijn in principe niet langer ingeschreven. Je kan dan wel nog steeds aan alle gegevens van die leden. Je kan leden dus herinneren om zeker in te schrijven voor de nieuwe inschrijvingsperiode.</p>

            <p class="style-description">
                Het is aan te raden om leden niet gewoon uit te schrijven of te verwijderen, want op die manier kan je niet langer gebruik maken van handige functies in Stamhoofd. Zo kan bijvoorbeeld inschrijven beperkten tot leden die de vorige inschrijvingsperiode al ingeschreven waren, of kan je met voorinschrijvingen werken: leden die de vorige inschrijvingsperiode al waren ingeschreven kunnen al sneller beginnen met inschrijven.
            </p>

            <p class="info-box">
                Kies hieronder voor welke inschrijvingsgroepen je een nieuwe inschrijvingsperiode wilt starten.
            </p>

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
                    <button class="button primary" @click="save">
                        Nieuwe inschrijvingsperiode
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Group, Organization, OrganizationType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

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
    validator = new Validator()
    saving = false

    @Prop({ required: true })
    initialGroupIds!: string[]

    groupIds = this.initialGroupIds.slice()

    get categoryTree() {
        return OrganizationManager.organization.getCategoryTreeWithDepth(1).filterForDisplay(true, true)
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

        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }
        this.saving = true

        this.errorBox = null

        try {
            const p = Organization.patch({
                id: OrganizationManager.organization.id
            })

            for (const id of this.groupIds) {
                const group = OrganizationManager.organization.groups.find(g => g.id === id)
                if (!group) {
                    throw new Error("Een groep bestaat niet meer")
                }
                p.groups.addPatch(Group.patch({
                    id,
                    cycle: group.cycle + 1
                }))
            }
            
            await OrganizationManager.patch(p)
            this.pop({ force: true })

            new Toast("De nieuwe inschrijvingsperiode is gestart. Vergeet niet om ook de inschrijvingsdatums aan te passen.").show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    cancel() {
        this.pop()
    }

}
</script>