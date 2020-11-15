<template>
    <div>
        Deze webshop bestaat niet
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";

@Component({})
export default class InvalidWebshopView extends Mixins(NavigationMixin){

}
</script>