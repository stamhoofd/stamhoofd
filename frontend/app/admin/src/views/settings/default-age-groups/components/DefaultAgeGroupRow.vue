<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ group.name }}
        </h2>

        <p v-if="group.description" class="style-description">
            {{ group.description }}
        </p>

        <p v-if="group.minAge && group.maxAge" class="style-description">
            {{ group.minAge }} - {{ group.maxAge }} {{ $t('jaar') }}
        </p>

        <p v-if="!group.defaultMembershipTypeId" class="style-description">
            {{ $t('Geen automatische aansluiting') }}
        </p>

        <p v-if="group.minimumRequiredMembers" class="style-description">
            {{ $t('Minimum') }} {{ Formatter.pluralText(group.minimumRequiredMembers, 'lid', 'leden') }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop/>
            <span class="icon arrow-right-small gray"/>
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
