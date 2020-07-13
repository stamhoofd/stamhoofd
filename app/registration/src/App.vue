<template>
    <div id="app">
        Registratie wip
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";

// kick off the polyfill!
//smoothscroll.polyfill();
@Component({
    components: {
        ModalStackComponent
    },
})
export default class App extends Vue {
    
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
