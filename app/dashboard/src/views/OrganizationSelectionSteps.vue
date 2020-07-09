<template>
    <Steps :root="root">
        <template slot="right">
            <button class="button primary">
                Mijn vereniging aansluiten
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import Steps from "@stamhoofd/components/src/steps/Steps.vue"
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    components: {
        Steps
    },
})
export default class OrganizationSelectionSteps extends Vue {
    @Prop({ required: true })
    root!: ComponentWithProperties
}
</script>