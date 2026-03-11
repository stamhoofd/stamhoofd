<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`%Wp`)" />

        <main>
            <h1>
                {{ $t('%Wl') }}
            </h1>
            <p>
                {{ $t('%Wm') }}
            </p>

            (todo)
        </main>

        <STToolbar>
            <template #left>
                {{ $t('%Wn') }}
            </template>
            <template #right>
                <button class="button primary" type="submit">
                    {{ $t('%Wo') }}
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
