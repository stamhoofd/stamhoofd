<template>
    <Window :root="root" />
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import { Component, Vue } from "vue-property-decorator";

import Window from "../Window.vue";
import LaunchView from "./LaunchView.vue";

@Component({
    components: {
        Window
    },
})
export default class LoginWindow extends Vue {
    public root = new ComponentWithProperties(LaunchView);
}
</script>