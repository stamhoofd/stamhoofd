<template>
    <div class="st-view">
        <STNavigationBar :large="true" />

        <main class="center">
            <h1>{{ $t('%WC') }}</h1>
            <p>{{ $t('%WD') }} {{ organization.name }}{{ $t('%WE') }}</p>
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
