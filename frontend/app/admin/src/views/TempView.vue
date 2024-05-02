<template>
    <div class="st-view temp-view">
        <STNavigationBar :large="true" :sticky="false">
            <template #left>
                <a id="logo" class="responsive" alt="Stamhoofd" href="https://www.stamhoofd.be" rel="noopener" />
            </template>

            <template #right>
                <a class="button text" href="https://www.stamhoofd.app" rel="noopener">
                    <span class="icon external" />
                    <span>Terug</span>
                    <span class="hide-smartphone">naar app</span>
                </a>
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <div class="centered-view">
                <h1>Hello world</h1>

                <button class="button primary" @click="logout">Uitloggen</button>
                
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Spinner,STNavigationBar } from '@stamhoofd/components';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { AdminSession } from "../classes/AdminSession";

@Component({
    components: {
        Spinner,
        STNavigationBar
    }
})
export default class TempView extends Mixins(NavigationMixin){
    logout() {
        AdminSession.shared.logout()
    }
}
</script>