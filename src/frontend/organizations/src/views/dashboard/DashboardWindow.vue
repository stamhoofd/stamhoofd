<template>
    <Window :root="root" />
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import SplitViewController from "@stamhoofd/shared/components/layout/SplitViewController.vue";
import Menu from "./Menu.vue";
import Window from "../Window.vue";

@Component({
    components: {
        Window
    },
})
export default class DashboardWindow extends Vue {
    public root = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(Menu, {}),
    });
}
</script>