<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="permissions-checked-view">
        <LoadingViewTransition :error-box="errorBox">
            <template v-if="!preventComplete">
                <ComponentWithPropertiesInstance v-if="hasPermissions" :key="root.key" :component="root" />
                <ComponentWithPropertiesInstance v-else-if="isComplete" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
            </template>
        </LoadingViewTransition>
    </div>
</template>

<script lang="ts">
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import LoadingViewTransition from './LoadingViewTransition.vue';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingViewTransition,
    },
})
export default class PermissionsCheckedView extends VueComponent {
    @Prop()
    root!: ComponentWithProperties;

    @Prop()
    noPermissionsRoot!: ComponentWithProperties;

    hasPermissions = false;
    isComplete = false;
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
        this.isComplete = (((this as any).$context as SessionContext).isComplete() ?? false);
        this.hasPermissions = (((this as any).$context as SessionContext).isComplete() ?? false) && !!((this as any).$context as SessionContext).auth.permissions && !((this as any).$context as SessionContext).auth.permissions?.isEmpty;
        this.errorBox = ((this as any).$context as SessionContext).loadingError ? new ErrorBox(((this as any).$context as SessionContext).loadingError) : null;
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
        if (this.hasPermissions) {
            return await this.root.shouldNavigateAway();
        }
        if (this.isComplete) {
            return await this.noPermissionsRoot.shouldNavigateAway();
        }
        return true;
    }
}
</script>
