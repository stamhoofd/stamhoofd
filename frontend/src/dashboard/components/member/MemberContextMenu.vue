<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem>Groep wijzigen</ContextMenuItem>
        <ContextMenuLine></ContextMenuLine>
        <ContextMenuItem v-for="(parent, index) in member.parents" :key="index" click="call(parent.phone)"
            >{{ parent.firstName }} ({{ ParentTypeHelper.getName(parent.type) }}) bellen</ContextMenuItem
        >
        <ContextMenuItem>Ouders SMS'en</ContextMenuItem>
        <ContextMenuItem>Ouders mailen</ContextMenuItem>
        <ContextMenuLine></ContextMenuLine>
        <ContextMenuItem>{{ member.firstName }} bellen</ContextMenuItem>
        <ContextMenuItem>{{ member.firstName }} SMS'en</ContextMenuItem>
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
import { Member } from "shared/models/Member";
import { ParentTypeHelper } from "shared/models/ParentType";

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

    @Prop()
    member!: Member;

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
    }

    mounted() {}

    call(phone) {
        window.location.href = "tel://" + phone.replace(" ", "");
    }
}
</script>
