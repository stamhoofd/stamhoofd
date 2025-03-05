<template>
    <div class="st-view">
        <main class="center">
            <h1>{{ $t('edd3b3e5-94fb-49e4-86bd-cbb705ecca21') }}</h1>
            <p>{{ $t('0327b4f1-3eb9-414b-9bb7-db00a995184f') }} {{ organization.name }}{{ $t('b0e0bba3-355a-41b9-a73b-fabe4a0057c6') }}</p>
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
