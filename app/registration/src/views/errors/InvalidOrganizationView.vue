<template>
    <div>
        Deze vereniging bestaat niet
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";

@Component({})
export default class InvalidOrganizationView extends Mixins(NavigationMixin){

}
</script>