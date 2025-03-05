<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`5aad49ab-206d-4906-a712-e99a20555a9e`)"/>

        <main>
            <h1>
                {{ $t('9bb1f299-8215-42dd-8e14-29026de871ae') }}
            </h1>
            <p>
                {{ $t('f26e4597-353d-434b-a901-6331511997ef') }}
            </p>

            <ModuleSettingsBox/>
        </main>

        <STToolbar>
            <template #left>
                {{ $t('80c5fe65-1f6f-4a79-975a-dbdead7894db') }}
            </template>
            <template #right>
                <button class="button primary" type="submit">
                    {{ $t('8960f2e2-2445-484d-af2d-94eb94ae684e') }}
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, Checkbox, EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';

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
