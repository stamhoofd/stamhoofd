<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div :key="userId || 'unknown'">
        <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
        <ComponentWithPropertiesInstance v-else-if="noPermissionsRoot && showPermissionsRoot" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
        <LoadingView v-else-if="hasToken" key="loadingView" />
        <ComponentWithPropertiesInstance v-else :key="loginRoot.key" :component="loginRoot" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

import LoadingView from "./LoadingView.vue";

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingView
    }
})
export default class AuthenticatedView extends Vue {
    @Prop()
        root!: ComponentWithProperties

    @Prop()
        loginRoot!: ComponentWithProperties

    /**
     * Set this as the root when the user doesn't have permissions (don't set if permissions are not needed)
     */
    @Prop()
        noPermissionsRoot!: ComponentWithProperties | null

    loggedIn = false
    userId: string | null = null
    hasToken = false
    showPermissionsRoot = false
    lastOrganizationFetch = new Date()

    created() {
        // We need to check data already before loading any component!
        this.changed()
        this.$context.addListener(this, this.changed.bind(this));
        document.addEventListener("visibilitychange", this.onVisibilityChange);
    }

    beforeUnmount() {
        this.$context.removeListener(this);
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }

    changed() {
        if (this.noPermissionsRoot) {
            this.loggedIn = (this.$context.isComplete() ?? false) && !!this.$context.user && this.$context.user.permissions != null
            this.hasToken = this.$context.hasToken() ?? false
            this.showPermissionsRoot = this.$context.isComplete() ?? false
            this.userId = this.$context.user?.id ?? null
        } else {
            this.loggedIn = this.$context.isComplete() ?? false
            this.hasToken = this.$context.hasToken() ?? false
            this.showPermissionsRoot = false
            this.userId = this.$context.user?.id ?? null
        }
        console.log('changed', this.loggedIn, this.userId, this.hasToken, this.showPermissionsRoot);
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // TODO
            console.info("Window became visible again")

            if (!this.$context || !this.$context.isComplete()) {
                return
            }

            if (STAMHOOFD.environment === 'development' || this.lastOrganizationFetch.getTime() + 1000 * 60 * 5 < new Date().getTime()) {
                // Update when at least 5 minutes inactive
                console.info("Updating organization")
                this.lastOrganizationFetch = new Date()

                this.$context.updateData(true, false, false).catch(console.error)
            }
        }
    }
}
</script>