<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack"/>
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward"/>
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
                        {{ $t('a902358b-991b-46af-882f-8e982dc5c0d1') }} {{ formatPrice(item.amountPending) }} {{ $t('d2728495-de3c-4730-b4d3-4d11223ea2bc') }}
                    </p>
                    <p v-if="item.amountPending < 0" class="style-description-small">
                        {{ $t('fd658785-9c3e-4c9c-a0d3-448bfb288d4c') }} {{ formatPrice(-item.amountPending) }} {{ $t('90541b50-5989-4a97-949c-19b13ff37df0') }}
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
                        {{ $t('a04fd86b-8055-4820-9fd4-dab6a6d6c7e6') }} {{ formatPrice(item.amountPending) }} {{ $t('cb770768-0857-409d-af67-4338a080b85a') }}
                    </p>
                    <p v-if="item.amountPending < 0" class="style-description-small">
                        {{ $t('cb7333ff-7270-4f82-b372-4bcdea86f3b2') }} {{ formatPrice(-item.amountPending) }} {{ $t('93a9ad5c-46fa-45f8-b534-682b1bc78659') }}
                    </p>
                </STListItem>

                <STListItem v-if="item.amountOpen > 0 && $feature('balance-emails')">
                    <h3 class="style-definition-label">
                        {{ $t('a8bf2d7d-3208-4c18-bac3-2cc97b629ad1') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ item.lastReminderEmail && item.reminderEmailCount > 0 ? formatDateTime(item.lastReminderEmail, true) : 'Nog niet verstuurd' }}
                    </p>
                    <p v-if="item.lastReminderEmail && item.reminderEmailCount > 1" class="style-description-small">
                        {{ $t('e6f75293-bd61-49d9-ae02-aba166f67e7e') }} {{ item.reminderEmailCount }} {{ $t('126a254e-7223-4096-a38d-4a7c53159543') }}
                    </p>
                    <p v-if="item.lastReminderEmail && item.reminderEmailCount && item.lastReminderAmountOpen !== item.amountOpen" class="style-description-small">
                        {{ $t('db73f771-f05e-4c42-a10f-807578b18a54') }} {{ formatPrice(item.lastReminderAmountOpen) }}
                    </p>
                    <p v-if="!item.lastReminderEmail || item.reminderEmailCount === 0" class="style-description-small">
                        {{ $t('ec57dfee-1ea7-48d8-aa1a-402d9ec87c81') }}
                    </p>
                </STListItem>
            </STList>

            <hr><ReceivableBalanceBox :item="item" :member="member" :hide-segmented-control="false"/>
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

const $t = useTranslate();
const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);
const title = computed(() => {
    return $t('28c2bc66-231f-44f3-9249-c1981b871a1f');
});

</script>
