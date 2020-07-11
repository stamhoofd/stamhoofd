<template>
    <div>
        <FramedComponent v-if="loggedIn" :key="root.key" :root="root" />
        <FramedComponent v-else :key="loginRoot.key" :root="loginRoot" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, FramedComponent } from "@simonbackx/vue-app-navigation";
import {SessionManager} from "@stamhoofd/networking"
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    components: {
        FramedComponent
    },
})
export default class AuthenticatedView extends Vue {
    @Prop()
    root: ComponentWithProperties

    @Prop()
    loginRoot: ComponentWithProperties

    loggedIn = SessionManager.currentSession?.hasToken() ?? false

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
        this.loggedIn = SessionManager.currentSession?.hasToken() ?? false
    }
}
</script>