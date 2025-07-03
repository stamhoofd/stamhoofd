<template>
    <SaveView :title="title" :save-text="$t('Sluiten')" @save="() => pop()">
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>

        <STList>
            <STListItem v-for="(member, index) in members" :key="index">
                <h3 class="style-list-title">
                    {{ member.name }}
                </h3>
                <p v-if="member.description" class="style-description-small pre-wrap" v-text="member.description" />
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { STList, STListItem } from '@stamhoofd/components';

defineProps<{
    title: string;
    description: string;
    members: { name: string; description?: string }[];
}>();

const pop = usePop();
</script>
