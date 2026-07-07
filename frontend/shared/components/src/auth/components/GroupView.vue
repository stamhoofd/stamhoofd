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

            <div class="container">
                <STList>
                    <STListItem>
                        <template #left>
                            <span class="icon event" />
                        </template>
                        <h2 class="style-title-list">
                            <span v-if="group.settings.displayStartEndTime">{{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}</span>
                            <span v-else>{{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}</span>
                        </h2>
                    </STListItem>
                    <STListItem v-if="group.settings.location">
                        <template #left>
                            <span class="icon location" />
                        </template>
                        <h2 class="style-title-list">
                            {{ group.settings.location }}
                        </h2>
                    </STListItem>
                    <STListItem v-if="who">
                        <template #left>
                            <span class="icon filter" />
                        </template>
                        <h2 class="style-title-list">
                            {{ who }}
                        </h2>
                    </STListItem>
                    <template v-if="priceList.length === 1">
                        <template v-for="(price, index) of priceList" :key="index">
                            <STListItem class="right-stack">
                                <template #left>
                                    <span class="icon receive small" />
                                </template>
                                <h2 class="style-title-list">
                                    {{ price.text }}
                                </h2>
                                <p v-if="price.description" class="style-description-small">
                                    {{ price.description }}
                                </p>
                                <template #right>
                                    <span>{{ price.price }}</span>
                                </template>
                            </STListItem>
                            <STListItem v-if="price.reducedPrice !== null" class="right-stack">
                                <template #left>
                                    <span class="icon label small" />
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%1Vy') }}
                                </h2>

                                <p class="style-description-small">
                                    {{ $t('%1cu') }}
                                </p>
                                <template #right>
                                    <span>{{ price.reducedPrice }}</span>
                                </template>
                            </STListItem>
                        </template>
                    </template>
                </STList>
            </div>

            <div v-if="priceList.length > 1" class="container">
                <hr>
                <h2>
                    {{ $t('Tarieven') }}
                </h2>
                <STList>
                    <template v-for="(price, index) of priceList" :key="index">
                        <STListItem class="right-stack">
                            <h2 class="style-title-list">
                                {{ price.text }}
                            </h2>
                            <p v-if="price.description" class="style-description-small">
                                {{ price.description }}
                            </p>
                            <template #right>
                                <span>{{ price.price }}</span>
                            </template>
                        </STListItem>
                        <STListItem v-if="price.reducedPrice !== null" class="right-stack">
                            <h2 class="style-title-list">
                                {{ price.text }} - {{ financialSupportSettings.priceName }}
                            </h2>

                            <p class="style-description-small">
                                {{ $t('%1cu') }}
                            </p>
                            <template #right>
                                <span>{{ price.reducedPrice }}</span>
                            </template>
                        </STListItem>
                    </template>
                </STList>
            </div>

            <template v-for="menu of optionMenuList" :key="menu.id">
                <hr>
                <div class="container">
                    <h2>{{ menu.name }}</h2>

                    <STList>
                        <template v-for="option of menu.optionList" :key="option.id">
                            <STListItem class="right-stack">
                                <h2 class="style-title-list">
                                    {{ option.text }}
                                </h2>
                                <p v-if="option.description" class="style-description-small">
                                    {{ option.description }}
                                </p>
                                <template v-if="menu.shouldShowPrices" #right>
                                    <span>{{ option.price }}</span>
                                </template>
                            </STListItem>
                            <STListItem v-if="menu.shouldShowPrices && option.reducedPrice !== null" class="right-stack">
                                <h2 class="style-title-list">
                                    {{ option.text }} - {{ financialSupportSettings.priceName }}
                                </h2>

                                <p class="style-description-small">
                                    {{ $t('%1cu') }}
                                </p>
                                <template #right>
                                    <span>{{ option.reducedPrice }}</span>
                                </template>
                            </STListItem>
                        </template>
                    </STList>
                </div>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { useFinancialSupportSettings } from '#groups/hooks/useFinancialSupportSettings.ts';
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

const { enabled: isFinancialSupportEnabled, financialSupportSettings } = useFinancialSupportSettings({
    group: computed(() => props.group),
    externalOrganization: organization,
});

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

function formatDate(date: Date) {
    return Formatter.date(date);
}

function groupName(id: string): string {
    return organization.value?.period.groups.find(g => g.id === id)?.settings.name.toString() ?? $t('%Gr');
}

function getStockText<T extends { getRemainingStock: (group: Group) => number | null }>(item: T): string {
    const remainingStock = item.getRemainingStock(props.group);
    if (remainingStock === null) {
        return '';
    }

    if (remainingStock <= 0) {
        return $t('%Um');
    }

    return remainingStock !== 1 ? $t('%1d9', { count: remainingStock }) : $t('Nog één plaats');
}

const priceList = computed(() => {
    const list: { text: string; description: string; price: string; reducedPrice: string | null }[] = [];

    for (const price of props.group.settings.getFilteredPrices()) {
        const remainingStockText = getStockText(price);

        list.push({
            text: Formatter.capitalizeFirstLetter(price.name.toString()) || $t('%1IP'),
            description: remainingStockText,
            price: Formatter.price(price.price.price),
            reducedPrice: isFinancialSupportEnabled.value && price.price.reducedPrice !== null && price.price.reducedPrice !== price.price.price ? Formatter.price(price.price.reducedPrice) : null,
        });
    }

    return list;
});

const optionMenuList = computed(() => {
    const menuList: { id: string; name: string; shouldShowPrices: boolean; optionList: { id: string; text: string; description: string; price: string; reducedPrice: string | null }[] }[] = [];

    for (const optionMenu of props.group.settings.optionMenus) {
        const optionList: { id: string; text: string; description: string; price: string; reducedPrice: string | null }[] = [];

        const visibleOptions = optionMenu.options.filter(o => !o.hidden);

        // only show prices if at least one option has a price
        const shouldShowPrices = visibleOptions.some(o => o.price.price !== 0 || (o.price.reducedPrice !== null && o.price.reducedPrice !== 0));

        // only show if at least one option is relevant (= has a price or a stock)
        if (shouldShowPrices || visibleOptions.some(o => o.getRemainingStock(props.group) !== null)) {
            for (const option of visibleOptions) {
                if (option.hidden) {
                    continue;
                }

                const remainingStockText = getStockText(option);

                optionList.push({
                    id: option.id,
                    text: option.name.toString(),
                    description: remainingStockText,
                    price: Formatter.price(option.price.price),
                    reducedPrice: isFinancialSupportEnabled.value && option.price.reducedPrice !== null && option.price.reducedPrice !== option.price.price ? Formatter.price(option.price.reducedPrice) : null,

                });
            }

            if (optionList.length) {
                menuList.push({
                    id: optionMenu.id,
                    name: optionMenu.name.toString(),
                    shouldShowPrices,
                    optionList,
                });
            }
        }
    }

    return menuList;
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
