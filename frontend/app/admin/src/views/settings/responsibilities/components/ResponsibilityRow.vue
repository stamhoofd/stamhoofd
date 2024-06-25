<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ responsibility.name }}
        </h2>

        <p v-if="responsibility.description" class="style-description">
            {{ responsibility.description }}
        </p>

        <p v-if="responsibility.minimumMembers" class="style-description">
            Minimum {{ responsibility.minimumMembers }} vereist
        </p>
        
        <p v-if="responsibility.maximumMembers" class="style-description">
            Maximum {{ responsibility.maximumMembers }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { MemberResponsibility } from '@stamhoofd/structures';

defineProps<{
    responsibility: MemberResponsibility;
}>();

function showContextMenu() {
    // todo
}

</script>
