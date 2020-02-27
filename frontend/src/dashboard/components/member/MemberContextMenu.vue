<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem>Groep wijzigen</ContextMenuItem>
        <ContextMenuLine></ContextMenuLine>
        <ContextMenuItem @click="callParents">Mama bellen</ContextMenuItem>
        <ContextMenuItem @click="callParents">Papa bellen</ContextMenuItem>
        <ContextMenuItem>Ouders SMS'en</ContextMenuItem>
        <ContextMenuItem>Ouders mailen</ContextMenuItem>
        <ContextMenuLine></ContextMenuLine>
        <ContextMenuItem>Lid bellen</ContextMenuItem>
        <ContextMenuItem>Lid SMS'en</ContextMenuItem>
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

    callParents() {
        window.location.href = "tel://+32479427866";
    }
}
</script>
