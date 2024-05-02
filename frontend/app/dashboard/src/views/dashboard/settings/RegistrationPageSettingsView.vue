<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar title="Jullie ledenportaal" />

        <main>
            <h1>Jullie ledenportaal</h1>

            <p class="style-description">
                Leden kunnen zelfstandig inschrijven via het ledenportaal. Dit is een link die je op jouw website kan plaatsen of kan versturen via e-mail. Daarnaast kan je leden ook uitnodigen om in te schrijven, dat doe je door ze eerst toe te voegen in Stamhoofd en daarna een e-mail te sturen waarbij je de 'magische knop' onderaan toevoegt.
            </p>

            <hr>
            <h2 class="style-with-button">
                <div>Jullie ledenportaal</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">Openen</span>
                    </a>
                </div>
            </h2>

            <input v-tooltip="'Klik om te kopiëren'" class="input" :value="organization.registerUrl" readonly @click="copyElement">

            <p class="info-box">
                {{ $t('dashboard.settings.registrationPage.linkDescription') }}
            </p>

            <hr>
            <h2>Handige links</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/'" target="_blank">
                    <template #left><span class="icon link" /></template>
                    Documentatie
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/tag/ledenadministratie-instellen/'" target="_blank">
                    <template #left><span class="icon link" /></template>
                    Ledenadministratie instellen
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { OrganizationType } from "@stamhoofd/structures";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";



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
        return this.$organization
    }

    get isYouth() {
        return this.organization.meta.type === OrganizationType.Youth
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
            (displayedComponent.componentInstance() as any)?.hide?.()
        }, 1000);
    }
}
</script>
