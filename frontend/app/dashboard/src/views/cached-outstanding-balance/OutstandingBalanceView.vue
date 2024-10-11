<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige groep'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende groep'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Type') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ capitalizeFirstLetter(getCachedOutstandingBalanceTypeName(item.objectType, $t)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Naam') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ item.object.name }}
                    </p>
                </STListItem>
            </STList>

            <hr>

            <h2>Contactpersonen</h2>

            <p>Deze personen ontvangen een e-mail bij elke communicatie rond dit openstaand bedrag.</p>

            <STList class="info">
                <STListItem v-for="(contact, index) of item.object.contacts" :key="index">
                    <h3 class="style-definition-label">
                        {{ contact.firstName || 'Onbekende naam' }} {{ contact.lastName }}
                    </h3>
                    <p v-for="(email, j) of contact.emails" :key="j" v-copyable class="style-definition-text">
                        {{ email }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useBackForward } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { CachedOutstandingBalance, getCachedOutstandingBalanceTypeName } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    item: CachedOutstandingBalance;
    getNext: (current: CachedOutstandingBalance) => CachedOutstandingBalance | null;
    getPrevious: (current: CachedOutstandingBalance) => CachedOutstandingBalance | null;
}>();

const $t = useTranslate();
const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);

const title = computed(() => {
    return $t('Openstaand bedrag');
});

</script>
