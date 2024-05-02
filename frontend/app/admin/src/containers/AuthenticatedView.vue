<template>
    <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
    <LoadingView v-else-if="hasToken" />
    <ComponentWithPropertiesInstance v-else :key="loginRoot.key" :component="loginRoot" />
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { LoadingView } from "@stamhoofd/components"
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../classes/AdminSession";

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

    loggedIn = false
    hasToken = false

    created() {
        // We need to check data already before loading any component!
        this.changed()
        AdminSession.shared.addListener(this, this.changed.bind(this));
    }

    unmounted() {
        AdminSession.shared.removeListener(this);
    }

    changed() {
        this.loggedIn = AdminSession.shared.isComplete() ?? false
        this.hasToken = AdminSession.shared.hasToken() ?? false
    }
}
</script>