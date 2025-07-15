<template>
    <div class="st-view">
        <STNavigationBar :large="true" />

        <main class="center">
            <h1>{{ $t('a7e6596c-9614-426a-a9ef-dc6e32ec2864') }}</h1>
            <p>{{ $t('3abb6fe0-18cc-492b-9221-0a7825ecc9a2') }} {{ organization.name }}{{ $t('cf581821-fd16-416c-bdd2-be5315810373') }}</p>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { Logo, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Logo,
    },
})
export default class NoPermissionsView extends Mixins(NavigationMixin) {
    get organization() {
        return this.$organization;
    }

    gotoRegistration() {
        window.location.href = this.organization.registerUrl;
    }

    logout() {
        this.$context.logout();
    }
}
</script>
