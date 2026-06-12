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
                    {{ $t('Wanneer?') }}

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
                    {{ $t('Waar?') }}

                    <template #right>
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem v-if="who" class="right-description wrap">
                    {{ $t('Wie?') }}

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
    return organization.value?.period.groups.find(g => g.id === id)?.settings.name.toString() ?? $t('Onbekend');
}

const priceList = computed(() => {
    const list: { text: string; description: string; price: string }[] = [];

    for (const price of props.group.settings.getFilteredPrices()) {
        list.push({
            text: price.name.toString() || $t('Prijs'),
            description: '',
            price: Formatter.price(price.price.price),
        });

        if (price.price.reducedPrice !== null && price.price.reducedPrice !== price.price.price) {
            list.push({
                text: $t('Verlaagd tarief'),
                description: $t('Enkel voor gezinnen die in aanmerking komen voor financiële ondersteuning'),
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
                return $t('De inschrijvingen gaan open op {date}. Bestaande leden en broers/zussen kunnen al inschrijven vanaf {preDate}.', {
                    date: Formatter.startDate(settings.registrationStartDate, true),
                    preDate: Formatter.startDate(settings.preRegistrationsDate!, true),
                });
            }
            return $t('De inschrijvingen gaan open op {date}. Bestaande leden kunnen al inschrijven vanaf {preDate}.', {
                date: Formatter.startDate(settings.registrationStartDate, true),
                preDate: Formatter.startDate(settings.preRegistrationsDate!, true),
            });
        }
        return $t('De inschrijvingen gaan open op {date}', { date: Formatter.dateTime(settings.registrationStartDate, true) });
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
            return $t('Bestaande leden en broers en zussen kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten.');
        }
        return $t('Bestaande leden kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten.');
    }

    if (settings.waitingListType === WaitingListType.All) {
        return $t('Iedereen moet inschrijven op de wachtlijst');
    }

    return null;
});

const errorBox = computed(() => {
    const now = new Date();
    const settings = props.group.settings;

    if (settings.registrationEndDate && settings.registrationEndDate < now) {
        return $t('De inschrijvingen zijn afgelopen');
    }

    if (props.group.closed && !props.group.notYetOpen) {
        return $t('De inschrijvingen zijn gesloten');
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
        const prefix = $t('Iedereen die niet ingeschreven was bij {groups}', {
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
