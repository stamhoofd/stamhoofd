<template>
    <div id="members-activated-view" class="st-view background">
        <STNavigationBar title="Ledenadministratie is actief">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>Yay! 🥳 De ledenadministratie is actief</h1>
            <p>
                Alle activiteiten, lessen, leeftijdsgroepen, kampen of andere groepen waarvoor leden kunnen inschrijven worden 'inschrijvingsgroepen' genoemd. Die zijn onderverdeeld in categorieën (bv. lessen, kampen, activiteiten, leeftijdsgroepen) om wat structuur te brengen. Je kan ze in de volgende stap wijzigen.
            </p>

            <hr>
            <h2>Jouw inschrijvingspagina</h2>

            <p>
                Leden kunnen inschrijven voor inschrijvinsgroepen via je eigen inschrijvingspagina of via een uitnodiging in een e-mail (= e-mail sturen via Stamhoofd nadat je jouw leden hebt geïmporteerd).
            </p>


            <input v-tooltip="'Klik om te kopiëren'" class="input" :value="registerUrl" readonly @click="copyElement">

            <p class="info-box">
                Je kan deze link later terugvinden bij Instellingen > Personaliseren. Daar kan je ook je eigen domeinnaam instellen als je die hebt, bv. inschrijven.mijnvereniging.be.
            </p>

            <hr>
            <h2>Handige links</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" href="https://www.stamhoofd.be/docs" target="_blank">
                    <span slot="left" class="icon link" />
                    Documentatie
                </STListItem>

                <STListItem :selectable="true" element-name="a" href="https://www.stamhoofd.be/docs/domeinnaam-koppelen" target="_blank">
                    <span slot="left" class="icon link" />
                    Domeinnaam koppelen
                </STListItem>


                <STListItem :selectable="true" element-name="a" href="https://www.stamhoofd.be/docs/emails-versturen" target="_blank">
                    <span slot="left" class="icon link" />
                    E-mails versturen en e-mailadressen instellen
                </STListItem>

                <STListItem :selectable="true" element-name="a" href="https://www.stamhoofd.be/docs/overschakelen-midden-werkjaar" target="_blank">
                    <span slot="left" class="icon link" />
                    Overschakelen midden in een werkjaar
                </STListItem>

                <STListItem :selectable="true" element-name="a" href="https://www.stamhoofd.be/docs/online-inschrijvingen-kampen-weekends" target="_blank">
                    <span slot="left" class="icon link" />
                    Online inschrijvingen voor kampen en weekends
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton>
                    <button class="button primary" @click="manageGroups">
                        <span class="icon edit" />
                        <span>Inschrijvingsgroepen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STInputBox, STList, STListItem,STNavigationBar, STToolbar, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import { buildManageGroupsComponent } from "../../buildManageGroupsComponent";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        BackButton,
        LoadingButton,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class ActivatedView extends Mixins(NavigationMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get registerUrl() {
        if (this.organization.registerDomain) {
            return "https://"+this.organization.registerDomain
        } 

        return "https://"+this.organization.uri+'.'+process.env.HOSTNAME_REGISTRATION
    }

    manageGroups() {
        const component = buildManageGroupsComponent(this.organization)
            
        this.present(new ComponentWithProperties(NavigationController, {
            root: component
        }).setDisplayStyle("popup"))
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);
    }
}
</script>
