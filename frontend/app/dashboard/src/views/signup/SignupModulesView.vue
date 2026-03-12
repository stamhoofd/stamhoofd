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
import BackButton from '@stamhoofd/components/navigation/BackButton.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';

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
