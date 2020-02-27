<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem>Toegang wijzigen</ContextMenuItem>
        <ContextMenuItem>Mailen</ContextMenuItem>
        <ContextMenuLine></ContextMenuLine>
        <ContextMenuItem>Uitschrijven</ContextMenuItem>
        <ContextMenuItem>Data verwijderen</ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch, Mixins } from "vue-property-decorator";
import ContextMenu from "shared/components/overlays/ContextMenu.vue";
import ContextMenuItem from "shared/components/overlays/ContextMenuItem.vue";
import ContextMenuLine from "shared/components/overlays/ContextMenuLine.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine
    }
})
export default class MemberContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    mounted() {}
}
</script>
