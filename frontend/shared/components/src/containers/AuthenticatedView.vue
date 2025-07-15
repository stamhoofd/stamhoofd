<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="authenticated-view">
        <LoadingViewTransition :error-box="errorBox">
            <template v-if="!preventComplete">
                <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
                <ComponentWithPropertiesInstance v-else-if="noPermissionsRoot && showPermissionsRoot" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
                <ComponentWithPropertiesInstance v-else-if="!hasToken" :key="loginRoot.key" :component="loginRoot" />
            </template>
        </LoadingViewTransition>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import LoadingViewTransition from './LoadingViewTransition.vue';
import { SessionContext } from '@stamhoofd/networking';

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
    preventComplete = false;

    created() {
        // We need to check data already before loading any component!
        this.changed();
        ((this as any).$context as SessionContext).addListener(this, this.changed.bind(this));
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    beforeUnmount() {
        ((this as any).$context as SessionContext).removeListener(this);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    changed() {
        if (this.noPermissionsRoot) {
            this.loggedIn = (((this as any).$context as SessionContext).isComplete() ?? false) && !!((this as any).$context as SessionContext).auth.permissions && !((this as any).$context as SessionContext).auth.permissions?.isEmpty;
            this.hasToken = (((this as any).$context as SessionContext).hasToken() ?? false);
            this.showPermissionsRoot = ((this as any).$context as SessionContext).isComplete() ?? false;
            this.userId = ((this as any).$context as SessionContext).user?.id ?? null;
            this.errorBox = ((this as any).$context as SessionContext).loadingError ? new ErrorBox(((this as any).$context as SessionContext).loadingError) : null;
        }
        else {
            this.loggedIn = ((this as any).$context as SessionContext).isComplete() ?? false;
            this.hasToken = (((this as any).$context as SessionContext).hasToken() ?? false);
            this.showPermissionsRoot = false;
            this.userId = ((this as any).$context as SessionContext).user?.id ?? null;
            this.errorBox = ((this as any).$context as SessionContext).loadingError ? new ErrorBox(((this as any).$context as SessionContext).loadingError) : null;
        }
        this.preventComplete = ((this as any).$context as SessionContext).preventComplete ?? false;
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // TODO
            console.info('Window became visible again');

            if (!((this as any).$context as SessionContext) || !((this as any).$context as SessionContext).isComplete()) {
                return;
            }

            if (STAMHOOFD.environment === 'development' || this.lastOrganizationFetch.getTime() + 1000 * 60 * 5 < new Date().getTime()) {
                // Update when at least 5 minutes inactive
                console.info('Updating organization');
                this.lastOrganizationFetch = new Date();

                ((this as any).$context as SessionContext).updateData(true, false, false).catch(console.error);
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
