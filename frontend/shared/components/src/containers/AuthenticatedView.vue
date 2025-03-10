<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="authenticated-view">
        <LoadingViewTransition :error-box="errorBox">
            <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
            <ComponentWithPropertiesInstance v-else-if="noPermissionsRoot && showPermissionsRoot" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
            <ComponentWithPropertiesInstance v-else-if="!hasToken" :key="loginRoot.key" :component="loginRoot" />
        </LoadingViewTransition>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import LoadingViewTransition from './LoadingViewTransition.vue';

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingViewTransition,
    },
})
export default class AuthenticatedView extends VueComponent {
    @Prop()
    root!: ComponentWithProperties;

    @Prop()
    loginRoot!: ComponentWithProperties;

    /**
     * Set this as the root when the user doesn't have permissions (don't set if permissions are not needed)
     */
    @Prop()
    noPermissionsRoot!: ComponentWithProperties | null;

    loggedIn = false;
    userId: string | null = null;
    hasToken = false;
    showPermissionsRoot = false;
    lastOrganizationFetch = new Date();
    errorBox: ErrorBox | null = null;

    created() {
        // We need to check data already before loading any component!
        this.changed();
        this.$context.addListener(this, this.changed.bind(this));
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    beforeUnmount() {
        this.$context.removeListener(this);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    changed() {
        if (this.noPermissionsRoot) {
            this.loggedIn = (this.$context.isComplete() ?? false) && !!this.$context.auth.permissions && !this.$context.auth.permissions.isEmpty;
            this.hasToken = this.$context.hasToken() ?? false;
            this.showPermissionsRoot = this.$context.isComplete() ?? false;
            this.userId = this.$context.user?.id ?? null;
            this.errorBox = this.$context.loadingError ? new ErrorBox(this.$context.loadingError) : null;
        }
        else {
            this.loggedIn = this.$context.isComplete() ?? false;
            this.hasToken = this.$context.hasToken() ?? false;
            this.showPermissionsRoot = false;
            this.userId = this.$context.user?.id ?? null;
            this.errorBox = this.$context.loadingError ? new ErrorBox(this.$context.loadingError) : null;
        }
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // TODO
            console.info('Window became visible again');

            if (!this.$context || !this.$context.isComplete()) {
                return;
            }

            if (STAMHOOFD.environment === 'development' || this.lastOrganizationFetch.getTime() + 1000 * 60 * 5 < new Date().getTime()) {
                // Update when at least 5 minutes inactive
                console.info('Updating organization');
                this.lastOrganizationFetch = new Date();

                this.$context.updateData(true, false, false).catch(console.error);
            }
        }
    }

    async shouldNavigateAway() {
        if (this.loggedIn) {
            return await this.root.shouldNavigateAway();
        }
        if (this.noPermissionsRoot && this.showPermissionsRoot) {
            return await this.noPermissionsRoot.shouldNavigateAway();
        }
        if (!this.hasToken) {
            return await this.loginRoot.shouldNavigateAway();
        }
        return true;
    }
}
</script>
