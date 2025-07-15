<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="$t('1dd3e934-a69f-4a24-ba03-b945162e4c38')" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('9b500fcb-d4a2-4147-8422-c474a1297b5f')" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('4a07f8e5-c16e-4706-9387-9d3ded9e2b3c') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ capitalizeFirstLetter(getReceivableBalanceTypeName(item.objectType, $t)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('f7300ff2-638b-47c2-97b5-e8774aa0b6f5') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ item.object.name }}
                    </p>
                </STListItem>

                <STListItem v-if="item.object.uri">
                    <h3 class="style-definition-label">
                        {{ $t('cd798189-d5c8-4b79-98f7-a68786ab288c') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ item.object.uri }}
                    </p>
                </STListItem>

                <STListItem v-if="item.amountOpen >= 0">
                    <h3 class="style-definition-label">
                        {{ $t('28c2bc66-231f-44f3-9249-c1981b871a1f') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(item.amountOpen + Math.max(0, item.amountPending)) }}
                    </p>
                    <p v-if="item.amountPending > 0" class="style-description-small">
                        {{ $t('e6792924-6216-455e-9bfc-a555c716311f', {amount: formatPrice(item.amountPending)}) }}
                    </p>
                    <p v-if="item.amountPending < 0" class="style-description-small">
                        {{ $t('30fe0a04-5f5a-4d0e-84a3-17a7d4bb49e0', {amount: formatPrice(-item.amountPending)}) }}
                    </p>
                </STListItem>

                <STListItem v-else>
                    <h3 class="style-definition-label">
                        {{ $t('d9ba4476-8dbe-46d5-bad9-e49c062cbfa1') }}
                    </h3>
                    <p class="style-definition-text error">
                        {{ formatPrice(-item.amountOpen + Math.max(0, -item.amountPending)) }}
                    </p>
                    <p v-if="item.amountPending > 0" class="style-description-small">
                        {{ $t('5ba25f05-aba1-474d-83fe-3a7e25d7fa13', {amount: formatPrice(item.amountPending)}) }}
                    </p><p v-if="item.amountPending < 0" class="style-description-small">
                        {{ $t('7ce2a53b-e6ab-415a-a683-6daf1ae76897', {amount: formatPrice(-item.amountPending)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="item.amountOpen > 0">
                    <h3 class="style-definition-label">
                        {{ $t('a8bf2d7d-3208-4c18-bac3-2cc97b629ad1') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ item.lastReminderEmail && item.reminderEmailCount > 0 ? formatDateTime(item.lastReminderEmail, true) : $t('5cfae96d-516c-4b37-9ddf-afd21cab6574') }}
                    </p>
                    <p v-if="item.lastReminderEmail && item.reminderEmailCount > 1" class="style-description-small">
                        {{ $t('d2d006f9-8a7d-419b-9fa6-432a9e86bef7', {count: item.reminderEmailCount.toString()}) }}
                    </p>
                    <p v-if="item.lastReminderEmail && item.reminderEmailCount && item.lastReminderAmountOpen !== item.amountOpen" class="style-description-small">
                        {{ $t('dd903ff5-0b40-4393-b9d2-fc45af9b07c3', {amount: formatPrice(item.lastReminderAmountOpen)}) }}
                    </p>
                    <p v-if="!item.lastReminderEmail || item.reminderEmailCount === 0" class="style-description-small">
                        {{ $t('df3121cb-c5b1-405a-a34e-fd4d92d468ac') }}
                    </p>
                </STListItem>
            </STList>

            <hr><ReceivableBalanceBox :item="item" :member="member" :hide-segmented-control="false" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useBackForward } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { getReceivableBalanceTypeName, PlatformMember, ReceivableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';
import ReceivableBalanceBox from './ReceivableBalanceBox.vue';

const props = withDefaults(
    defineProps<{
        item: ReceivableBalance;
        getNext: (current: ReceivableBalance) => ReceivableBalance | null;
        getPrevious: (current: ReceivableBalance) => ReceivableBalance | null;
        member?: PlatformMember | null;
    }>(),
    {
        member: null,
    });

const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);
const title = computed(() => {
    return $t('28c2bc66-231f-44f3-9249-c1981b871a1f');
});

</script>
