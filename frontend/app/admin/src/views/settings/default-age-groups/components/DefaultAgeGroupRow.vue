<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ group.name }}
        </h2>

        <p v-if="group.description" class="style-description">
            {{ group.description }}
        </p>

        <p v-if="group.minAge && group.maxAge" class="style-description">
            {{ group.minAge }} - {{ group.maxAge }} {{ $t('608082c7-ce63-43c9-a577-ebaf56c4df82') }}
        </p>

        <p v-if="!group.defaultMembershipTypeId" class="style-description">
            {{ $t('c3bc8e44-f842-4bff-9aa0-d89028f6427a') }}
        </p>

        <p v-if="group.minimumRequiredMembers" class="style-description">
            {{ $t('e0a54e0c-03b3-43c6-b4ca-962c5b1d6772') }} {{ Formatter.pluralText(group.minimumRequiredMembers, 'lid', 'leden') }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { DefaultAgeGroup } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    group: DefaultAgeGroup;
}>();

function showContextMenu() {
    // todo
}

</script>
