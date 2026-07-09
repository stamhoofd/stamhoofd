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
                    <template v-if="whoList.length === 1">
                        <STListItem v-for="who of whoList" :key="who.title" :selectable="who.isSelectable" @click="openWhoDetails(who)">
                            <template #left>
                                <span class="icon filter" />
                            </template>
                            <h2 class="style-title-list">
                                {{ who.textIfSingleItem ?? who.title }}
                            </h2>
                            <template v-if="who.isSelectable" #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </template>
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
                                    {{ financialSupportSettings.priceName }}
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

            <div v-if="whoList.length > 1" class="container">
                <hr>
                <h2>
                    {{ $t('%Zcv') }}
                </h2>
                <STList>
                    <STListItem v-for="(who, index) of whoList" :key="who.title" :selectable="who.isSelectable" @click="openWhoDetails(who)">
                        <h2 v-if="index" class="style-title-list">
                            {{ $t('%bv') }} {{ who.title }}
                        </h2>
                        <h2 v-else class="style-title-list">
                            {{ Formatter.capitalizeFirstLetter(who.title) }}
                        </h2>
                        <p v-if="who.shortDescription" class="style-description-small">
                            {{ Formatter.capitalizeFirstLetter(who.shortDescription) }}
                        </p>
                        <template v-if="who.isSelectable" #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="priceList.length > 1" class="container">
                <hr>
                <h2>
                    {{ $t('%61') }}
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
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useGroupsObjectFetcher } from '#fetchers/useGroupsObjectsFetcher.ts';
import { useFinancialSupportSettings } from '#groups/hooks/useFinancialSupportSettings.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import ImageComponent from '#views/ImageComponent.vue';
import { Request } from '@simonbackx/simple-networking';
import { useShow } from '@simonbackx/vue-app-navigation';
import type { Group } from '@stamhoofd/structures';
import { LimitedFilteredRequest, WaitingListType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';
import GroupTag from './GroupTag.vue';

const props = defineProps<{
    group: Group;
}>();

const organization = useOrganization();
const show = useShow();

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

const groupMap = ref(new Map<string, Group>());

function getTextIfGroupsOverflow(count: number) {
    if (count === 1) {
        return $t('%ZcT');
    }
    return $t('%Zca', { count });
}

function getGroupsDescription({ groupIds, maxLength }: { groupIds: string[]; maxLength?: number }): { description: string; didOverflow: boolean } {
    if (groupIds.length < 3) {
        // always show all groups if there are less than 3
        maxLength = undefined;
    }

    let didOverflow = false;
    const description = Formatter.joinLastLimited(groupIds.map(groupName), {
        separator: ', ',
        lastSeparator: ` ${$t('%GT')} `,
        maxLength,
        textIfOverflow: (count) => {
            didOverflow = true;
            return getTextIfGroupsOverflow(count);
        },
    });

    return { description, didOverflow };
}

enum WhoType {
    AgeGender,
    RequiredGroups,
    PreventGroups,
}

type WhoItem = { title: string; shortDescription?: string; textIfSingleItem?: string; isSelectable?: boolean; type: WhoType };

const whoList = computed(() => {
    const items: WhoItem[] = [];
    const settings = props.group.settings;

    const ageGenderDescription = settings.getAgeGenderDescription({ includeAge: true, includeGender: true });
    if (ageGenderDescription) {
        items.push({
            type: WhoType.AgeGender,
            title: ageGenderDescription,
        });
    }

    if (settings.requireGroupIds.length > 0) {
        const { description, didOverflow } = getGroupsDescription({ groupIds: settings.requireGroupIds, maxLength: 100 });

        const textIfSingleItem = $t('%Zcj', {
            groups: description,
        });

        items.push({
            type: WhoType.RequiredGroups,
            title: $t('%Zcn'),
            textIfSingleItem,
            shortDescription: description,
            isSelectable: didOverflow,
        });
    }

    if (settings.preventGroupIds.length > 0) {
        const { description, didOverflow } = getGroupsDescription({ groupIds: settings.preventGroupIds, maxLength: 100 });

        const textIfSingleItem = $t('%ZcW', {
            groups: description,
        });

        items.push({
            type: WhoType.PreventGroups,
            title: $t('%ZcP'),
            textIfSingleItem,
            shortDescription: description,
            isSelectable: didOverflow,
        });
    }

    return items;
});

async function openWhoDetails(item: WhoItem) {
    if (!item.isSelectable) {
        return;
    }
    switch (item.type) {
        case WhoType.AgeGender: {
            break;
        }
        case WhoType.RequiredGroups: {
            await show({
                components: [
                    AsyncComponent(() => import('./GroupListView.vue'), {
                        title: $t('%Zcq'),
                        description: $t('%Zcu'),
                        groups: props.group.settings.requireGroupIds.flatMap((id) => {
                            const group = groupMap.value.get(id);
                            if (group) {
                                return [group];
                            }
                            return [];
                        }),
                    }),
                ],
            });
            break;
        }
        case WhoType.PreventGroups: {
            await show({
                components: [
                    AsyncComponent(() => import('./GroupListView.vue'), {
                        title: $t('%Zcd'),
                        description: $t('%ZcU'),
                        groups: props.group.settings.preventGroupIds.flatMap((id) => {
                            const group = groupMap.value.get(id);
                            if (group) {
                                return [group];
                            }
                            return [];
                        }),
                    }),
                ],
            });
            break;
        }
    }
}

function getGroupInfo(id: string): { name: string; periodName?: string } {
    const group = groupMap.value.get(id);

    if (group) {
        const period = organization.value?.period;
        const groupName = group.settings.name.toString();
        if (group.periodId !== period?.id && group.settings.period) {
            return {
                name: groupName,
                periodName: group.settings.period.name,
            };
        }
    }

    return { name: $t('%Gr') };
}

function groupName(id: string): string {
    const { name, periodName } = getGroupInfo(id);

    if (periodName) {
        return $t(`%Zct`, {
            group: name,
            period: periodName,
        });
    }

    return name;
}

const fetcher = useGroupsObjectFetcher(undefined, {
    shouldNotUseAuthenticatedServer: true,
});

onMounted(() => {
    loadGroups().catch(console.error);
});

async function loadGroups() {
    const settings = props.group.settings;
    const groupIds = [...new Set([...settings.requireGroupIds, ...settings.preventGroupIds])];
    const groups = await fetchGroups(groupIds);
    groupMap.value = new Map<string, Group>(groups.map(g => [g.id, g]));
}

async function fetchGroups(groupIds: string[]) {
    if (groupIds.length === 0) {
        return [];
    }

    let fetchedGroups: Group[] = [];

    const foundGroups: Group[] = [];
    const groupIdsToFetch: string[] = [];

    const period = organization.value?.period;

    if (period) {
        // prevent fetching groups that are already in the period
        for (const groupId of groupIds) {
            const foundGroup = period.groups.find(g => g.id === groupId);
            if (foundGroup) {
                foundGroups.push(foundGroup);
            } else {
                groupIdsToFetch.push(groupId);
            }
        }
    } else {
        groupIdsToFetch.push(...groupIds);
    }

    if (groupIdsToFetch.length === 0) {
        return foundGroups;
    }

    const getAllGroups = () => {
        return [...foundGroups, ...fetchedGroups];
    };

    try {
        const result = await fetcher.fetch(new LimitedFilteredRequest({
            filter: {
                id: {
                    $in: groupIdsToFetch,
                },
            },
            limit: groupIdsToFetch.length,
        }));

        fetchedGroups = result.results;
    } catch (e) {
        if (Request.isAbortError(e)) {
            return getAllGroups();
        }
        Toast.fromError(e).show();
    }

    return getAllGroups();
}
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
