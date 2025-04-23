<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar :title="$t(`Gelukt!`)" />

        <main>
            <h1>
                {{ $t('Gelukt! Jouw domeinnaam wordt binnenkort actief') }}
            </h1>

            <p v-if="enableMemberModule" class="st-list-description">
                {{ $t('Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails naar jouw leden automatisch vanaf @{mailDomain} verstuurd. Jullie ledenportaal zal waarschijnlijk al iets sneller beschikbaar zijn op {registerDomain}.', {mailDomain, registerDomain}) }}
            </p>
            <p v-else class="st-list-description">
                {{ $t('Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails automatisch vanaf @{mailDomain} verstuurd.', {mailDomain}) }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" @click="dismiss">
                    {{ $t('Sluiten') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TooltipDirective } from '@stamhoofd/components';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class DNSRecordsDoneView extends Mixins(NavigationMixin) {
    get organization() {
        return this.$organization;
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get registerDomain() {
        return this.$organization.registerDomain ?? '?';
    }

    get mailDomain() {
        return this.$organization.privateMeta?.mailDomain ?? '?';
    }
}
</script>
