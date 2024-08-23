<template>
    <div></div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Formatter } from "@stamhoofd/utility";

/**
 * Todo: this component should show warnings if a package is about to expire or a payment failed
 */

@Component({
    filters: {
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    emits: ["billing"]
})
export default class BillingWarningBox extends Mixins(NavigationMixin) {
    @Prop({ default: null })
        filterTypes: "members" | "webshops" | null



}
</script>
