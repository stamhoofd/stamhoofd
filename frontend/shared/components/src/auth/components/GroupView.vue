<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name.toString()" />

        <main>
            <h1>
                <span>{{ group.settings.name }}</span>
            </h1>
            <p><GroupTag :group="group" /></p>

            <ImageComponent v-if="group.settings.coverPhoto" :image="group.settings.coverPhoto" :auto-height="true" class="style-cover-photo" />

            <p v-if="infoBox" class="info-box">
                {{ infoBox }}
            </p>

            <p v-if="infoBox2" class="info-box">
                {{ infoBox2 }}
            </p>

            <p v-if="errorBox" class="error-box">
                {{ errorBox }}
            </p>

            <p v-if="group.settings.description" class="style-description pre-wrap" v-text="group.settings.description" />

            <STList class="group-info-list">
                <STListItem class="right-description">
                    {{ $t('%Vc') }}

                    <template #right>
                        <template v-if="group.settings.displayStartEndTime">
                            {{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}
                        </template>
                        <template v-else>
                            {{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}
                        </template>
                    </template>
                </STListItem>
                <STListItem v-if="group.settings.location" class="right-description">
                    {{ $t('%1Ye') }}

                    <template #right>
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem v-if="who" class="right-description wrap">
                    {{ $t('%1Wm') }}

                    <template #right>
                        <div v-text="who" />
                    </template>
                </STListItem>

                <STListItem v-for="(price, index) of priceList" :key="index">
                    <h3>{{ price.text }}</h3>
                    <p v-if="price.description" class="style-description-small">
                        {{ price.description }}
                    </p>

                    <template #right>
                        <div class="style-description" v-text="price.price" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { useOrganization } from '#hooks/useOrganization.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import ImageComponent from '#views/ImageComponent.vue';
import type { Group } from '@stamhoofd/structures';
import { WaitingListType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import GroupTag from './GroupTag.vue';

const props = defineProps<{
    group: Group;
}>();

const organization = useOrganization();

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

function formatDate(date: Date) {
    return Formatter.date(date);
}

function groupName(id: string): string {
    return organization.value?.period.groups.find(g => g.id === id)?.settings.name.toString() ?? $t('%Gr');
}

const priceList = computed(() => {
    const list: { text: string; description: string; price: string }[] = [];

    for (const price of props.group.settings.getFilteredPrices()) {
        list.push({
            text: price.name.toString() || $t('%1IP'),
            description: '',
            price: Formatter.price(price.price.price),
        });

        if (price.price.reducedPrice !== null && price.price.reducedPrice !== price.price.price) {
            list.push({
                text: $t('%1Vy'),
                description: $t('%1cu'),
                price: Formatter.price(price.price.reducedPrice),
            });
        }
    }

    return list;
});

const infoBox = computed(() => {
    const now = new Date();
    const settings = props.group.settings;

    if (settings.registrationStartDate && settings.registrationStartDate > now) {
        if (props.group.activePreRegistrationDate) {
            if (settings.priorityForFamily) {
                return $t('%1Y5', {
                    date: Formatter.startDate(settings.registrationStartDate, true),
                    preDate: Formatter.startDate(settings.preRegistrationsDate!, true),
                });
            }
            return $t('%1a2', {
                date: Formatter.startDate(settings.registrationStartDate, true),
                preDate: Formatter.startDate(settings.preRegistrationsDate!, true),
            });
        }
        return $t('%1UW', { date: Formatter.dateTime(settings.registrationStartDate, true) });
    }

    return null;
});

const infoBox2 = computed(() => {
    const now = new Date();
    const settings = props.group.settings;

    if ((settings.registrationEndDate && settings.registrationEndDate < now) || settings.isFull) {
        return null;
    }

    if (settings.waitingListType === WaitingListType.ExistingMembersFirst) {
        if (settings.priorityForFamily) {
            return $t('%1c1');
        }
        return $t('%1dU');
    }

    if (settings.waitingListType === WaitingListType.All) {
        return $t('%1Xd');
    }

    return null;
});

const errorBox = computed(() => {
    const now = new Date();
    const settings = props.group.settings;

    if (settings.registrationEndDate && settings.registrationEndDate < now) {
        return $t('%1Xv');
    }

    if (props.group.closed && !props.group.notYetOpen) {
        return $t('%b4');
    }

    return null;
});

const who = computed(() => {
    const settings = props.group.settings;
    let who = settings.getAgeGenderDescription({ includeAge: true, includeGender: true }) ?? '';

    if (settings.requireGroupIds.length > 0) {
        const prefix = Formatter.joinLast(settings.requireGroupIds.map(groupName), ', ', ' of ');
        who = who ? prefix + '\n' + who : prefix;
    }

    if (settings.preventGroupIds.length > 0) {
        const prefix = $t('%1VC', {
            groups: Formatter.joinLast(settings.preventGroupIds.map(groupName), ', ', ' of '),
        });
        who = who ? prefix + '\n' + who : prefix;
    }

    if (!who) {
        return null;
    }

    return who;
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
    p + .group-info-list {
        margin-top: 20px;
    }
}
</style>
