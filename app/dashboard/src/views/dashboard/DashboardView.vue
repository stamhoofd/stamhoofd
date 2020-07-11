<template>
    <div class="st-view login-view">
        <STNavigationBar title="Dashboard" />
        <main>
            <h1>Dashboard</h1>
            <p>Todo</p>

            <button class="primary button" @click="signOut">
                Uitloggen
            </button>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox
    }
})
export default class DashboardView extends Mixins(NavigationMixin){
    
    signOut() {
        // todo
    }
}
</script>

<style lang="scss">
</style>