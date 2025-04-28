<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`69ea4d40-e84c-4c40-b344-0d1c82e4af42`)" />

        <main>
            <h1>
                {{ $t('deb8b290-d12c-4fa5-827c-fc24decabbba') }}
            </h1>
            <p>
                {{ $t('167706de-e695-4695-95d6-662dd10c2a46') }}
            </p>

            (todo)
        </main>

        <STToolbar>
            <template #left>
                {{ $t('d11410bc-d04e-4145-a59e-75c0db0fc04f') }}
            </template>
            <template #right>
                <button class="button primary" type="submit">
                    {{ $t('e859a41b-e10b-4eac-a594-83decf3927c2') }}
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from '@stamhoofd/components';

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
    },
})
export default class SignupModulesView extends Mixins(NavigationMixin) {
    goNext() {
        this.dismiss({ force: true });
    }
}
</script>
