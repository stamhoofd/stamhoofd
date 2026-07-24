<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title">
                <span>{{ title }}</span>
            </h1>
            <p v-if="description" class="style-description">
                {{ description }}
            </p>

            <template v-for="group of groupsByPeriod" :key="group.category">
                <hr>
                <h2 class="style-title-list">
                    {{ group.category }}
                </h2>
                <STList>
                    <STListItem v-for="item of group.items" :key="item">
                        <h2 class="style-title-list">
                            {{ item.title }}
                        </h2>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import STList from '#layout/STList.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { Group } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    title: string;
    description?: string;
    groups: Group[];
}>();

const groupsByPeriod = computed(() => {
    const map = new Map<string, Group[]>();

    for (const group of props.groups) {
        const periodId = group.periodId;
        let groups = map.get(periodId);
        if (!groups) {
            groups = [];
            map.set(periodId, groups);
        }
        groups.push(group);
    }

    const periodGroups = [...map.entries()].map(([, groups]) => {
        const period = groups.find(g => g.settings.period)?.settings.period ?? null;
        return {
            period,
            groups,
        };
    });

    // sort most recent period first
    periodGroups.sort((a, b) => {
        if (!a.period && !b.period) {
            return 0;
        }

        if (!a.period) {
            return 1;
        }

        if (!b.period) {
            return -1;
        }

        return b.period.startDate.getTime() - a.period.startDate.getTime();
    });

    return periodGroups.map(({ period, groups }) => {
        return {
            category: period
                ? $t('%Zcc', { period: period.name })
                : $t('%Zg8'),
            items: groups.map((group) => {
                return {
                    title: group.settings.name.toString(),
                };
            }),
        };
    });
});

</script>
