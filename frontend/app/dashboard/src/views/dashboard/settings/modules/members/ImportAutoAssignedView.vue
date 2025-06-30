<template>
    <div id="import-members-auto-assigned-view" class="st-view background">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

        <main>
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
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="() => pop()">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useCanDismiss, useCanPop, usePop } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';

defineProps<{
    title: string;
    description: string;
    members: { name: string; description?: string }[];
}>();

const canDismiss = useCanDismiss();
const canPop = useCanPop();
const pop = usePop();
</script>
