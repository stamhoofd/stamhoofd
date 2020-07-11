<template>
    <div>
        <FramedComponent v-if="loggedIn" :key="root.key" :root="root" />
        <LoadingView v-else-if="hasToken" />
        <FramedComponent v-else :key="loginRoot.key" :root="loginRoot" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, FramedComponent } from "@simonbackx/vue-app-navigation";
import {SessionManager} from "@stamhoofd/networking"
import { Component, Prop, Vue } from "vue-property-decorator";

import LoadingView from "./LoadingView.vue"

@Component({
    components: {
        FramedComponent,
        LoadingView
    },
})
export default class AuthenticatedView extends Vue {
    @Prop()
    root: ComponentWithProperties

    @Prop()
    loginRoot: ComponentWithProperties

    loggedIn = SessionManager.currentSession?.isComplete() ?? false
    hasToken = SessionManager.currentSession?.hasToken() ?? false

    mounted() {
        this.changed();
        SessionManager.addListener(this, this.changed.bind(this));
    }

    activated() {
        this.changed();
        SessionManager.addListener(this, this.changed.bind(this));
    }

    deactivated() {
        SessionManager.removeListener(this);
    }

    destroyed() {
        SessionManager.removeListener(this);
    }

    changed() {
        console.log("Authenticated view changed")
        this.loggedIn = SessionManager.currentSession?.isComplete() ?? false
        this.hasToken = SessionManager.currentSession?.hasToken() ?? false
    }
}
</script>