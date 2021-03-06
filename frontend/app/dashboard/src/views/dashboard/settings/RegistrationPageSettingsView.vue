<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar title="Jouw inschrijvingspagina">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>Jouw inschrijvingspagina</h1>
            <p>
                Leden kunnen zelfstandig inschrijven via de inschrijvingspagina. Dit is een link die je op jouw website kan plaatsen of kan versturen via e-mail. Daarnaast kan je leden ook uitnodigen om in te schrijven, dat doe je door ze eerst toe te voegen in Stamhoofd en daarna een e-mail te sturen waarbij je de 'magische knop' onderaan toevoegt.
            </p>

            <hr>
            <h2>Jouw inschrijvingspagina</h2>

            <input v-tooltip="'Klik om te kopiëren'" class="input" :value="registerUrl" readonly @click="copyElement">

            <p class="info-box">
                Je kan deze link ook personaliseren met jouw eigen domeinnaam via Instellingen > Personaliseren. bv. inschrijven.mijnvereniging.be.
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
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STInputBox, STList, STListItem,STNavigationBar, STToolbar, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

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
export default class RegistrationPageSettingsView extends Mixins(NavigationMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get registerUrl() {
        if (this.organization.registerDomain) {
            return "https://"+this.organization.registerDomain
        } 

        return "https://"+this.organization.uri+'.'+process.env.HOSTNAME_REGISTRATION
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
