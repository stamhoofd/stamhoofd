<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div>
        <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
        <ComponentWithPropertiesInstance v-else-if="noPermissionsRoot && showPermissionsRoot" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
        <LoadingView v-else-if="hasToken" key="loadingView" />
        <ComponentWithPropertiesInstance v-else :key="loginRoot.key" :component="loginRoot" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import {SessionManager} from "@stamhoofd/networking"
import { Component, Prop, Vue } from "vue-property-decorator";

import LoadingView from "./LoadingView.vue"

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingView
    },
})
export default class AuthenticatedView extends Vue {
    @Prop()
    root: ComponentWithProperties

    @Prop()
    loginRoot: ComponentWithProperties

    /**
     * Set this as the root when the user doesn't have permissions (don't set if permissions are not needed)
     */
    @Prop()
    noPermissionsRoot: ComponentWithProperties | null

    loggedIn = false
    hasToken = false
    showPermissionsRoot = false

    created() {
        // We need to check data already before loading any component!
        this.changed()
        SessionManager.addListener(this, this.changed.bind(this));
    }

    destroyed() {
        SessionManager.removeListener(this);
    }

    changed() {
        if (this.noPermissionsRoot) {
            this.loggedIn = (SessionManager.currentSession?.isComplete() ?? false) && !!SessionManager.currentSession!.user && SessionManager.currentSession!.user.permissions != null
            this.hasToken = SessionManager.currentSession?.hasToken() ?? false
            this.showPermissionsRoot = SessionManager.currentSession?.isComplete() ?? false
        } else {
            this.loggedIn = SessionManager.currentSession?.isComplete() ?? false
            this.hasToken = SessionManager.currentSession?.hasToken() ?? false
            this.showPermissionsRoot = false
        }
    }
}
</script>