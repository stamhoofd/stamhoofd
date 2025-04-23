<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`Functies uitproberen`)" />

        <main>
            <h1>
                {{ $t('Kies de functies die je wilt uitproberen') }}
            </h1>
            <p>
                {{ $t('Test de functies eerst rustig uit voor je beslist om een pakket te kopen. Je hoeft geen betaalgegevens in te geven.') }}
            </p>

            <ModuleSettingsBox />
        </main>

        <STToolbar>
            <template #left>
                {{ $t('Je kan later deze functies wijzigingen via het instellingen menu.') }}
            </template>
            <template #right>
                <button class="button primary" type="submit">
                    {{ $t('Aan de slag') }}
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from '@stamhoofd/components';

import ModuleSettingsBox from '../dashboard/settings/ModuleSettingsBox.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        BackButton,
        EmailInput,
        Checkbox,
        ModuleSettingsBox,
    },
})
export default class SignupModulesView extends Mixins(NavigationMixin) {
    goNext() {
        this.dismiss({ force: true });
    }
}
</script>
