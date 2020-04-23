<template>
    <Window :root="root" />
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import LaunchView from "./LaunchView.vue";
import Window from "../Window.vue";

@Component({
    components: {
        Window
    },
})
export default class LoginWindow extends Vue {
    public root = new ComponentWithProperties(LaunchView);
}
</script>