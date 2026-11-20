<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>
            <p>{{ $t('Kies hoe lang gegevens bewaard blijven. Daarna worden ze automatisch geanonimiseerd of verwijderd.') }}</p>
            <p v-if="isOrganizationWithinPlatform">
                {{ $t('Elke rij toont wat er voor jullie vereniging echt geldt. Tussen de koepel en jullie vereniging geldt altijd de langste termijn.') }}
            </p>
            <p v-else-if="isPlatform">
                {{ $t('Verenigingen kunnen voor hun eigen gegevens een langere termijn instellen. De langste termijn geldt altijd.') }}
            </p>

            <LoadingBoxTransition :error-box="errors.errorBox">
                <STList v-if="settings" class="illustration-list">
                    <STListItem v-for="policy of settings.policies" :key="policy.category" :selectable="true" :data-testid="'data-retention-' + policy.category" @click="edit(policy)">
                        <h2 class="style-title-list">
                            {{ getDataRetentionCategoryName(policy.category) }}
                        </h2>
                        <p class="style-description-small">
                            {{ getSummary(policy) }}
                        </p>
                        <p v-if="getPlatformPolicy(policy.category)" class="style-description-small">
                            {{ getDataRetentionSourceDescription(getPlatformPolicy(policy.category)!, policy, now) }}
                        </p>
                        <p v-if="hasDocumentsWarning(policy)" class="style-description-small">
                            {{ $t('Documenten hebben geen termijn: bij geanonimiseerde leden blijft de naam daarin staan.') }}
                        </p>
                        <template #right>
                            <span v-if="getPendingFrom(policy)" class="style-tag warn">{{ $t('Wijzigt op {date}', { date: formatDate(getPendingFrom(policy)!) }) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </LoadingBoxTransition>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@browser/navigation';
import type { DataRetentionPolicy, DataRetentionSettings } from '@stamhoofd/structures';
import {
    DataRetentionCategory,
    getDataRetentionCategoryName,
    getDataRetentionSourceDescription,
    getDataRetentionTermsSummary,
    resolveDataRetentionTerms,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import LoadingBoxTransition from '#containers/LoadingBoxTransition.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useRequestOwner } from '#hooks/networking/useRequestOwner';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { loadDataRetentionSettings } from './dataRetentionRequests';

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const present = usePresent();
const organization = useOrganization();

const title = $t('Bewaartermijnen');
const now = new Date();
const settings = ref<DataRetentionSettings | null>(null);
const isPlatform = computed(() => !organization.value);
const isOrganizationWithinPlatform = computed(() => (settings.value?.platformPolicies.length ?? 0) > 0);

onMounted(async () => {
    try {
        settings.value = await loadDataRetentionSettings(context.value, owner);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
});

function getPlatformPolicy(category: DataRetentionCategory) {
    return settings.value?.platformPolicies.find(p => p.category === category) ?? null;
}

function getResolvedTerms(policy: DataRetentionPolicy) {
    return resolveDataRetentionTerms(getPlatformPolicy(policy.category), policy, now);
}

function getSummary(policy: DataRetentionPolicy) {
    return getDataRetentionTermsSummary(getResolvedTerms(policy));
}

function getPendingFrom(policy: DataRetentionPolicy) {
    return policy.pendingTerms && policy.pendingFrom && policy.pendingFrom > now ? policy.pendingFrom : null;
}

/**
 * Anonymizing a member keeps its documents with the name in them, until the term of documents passes.
 */
function hasDocumentsWarning(policy: DataRetentionPolicy) {
    if (policy.category !== DataRetentionCategory.Members || getResolvedTerms(policy).anonymizeAfterMonths === null) {
        return false;
    }
    const documents = settings.value?.policies.find(p => p.category === DataRetentionCategory.Documents);
    return !!documents && getResolvedTerms(documents).deleteAfterMonths === null;
}

function formatDate(date: Date) {
    return Formatter.date(date, true);
}

async function edit(policy: DataRetentionPolicy) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./EditDataRetentionTermView.vue'), {
                    policy,
                    platformPolicy: getPlatformPolicy(policy.category),
                    onSaved: (updated: DataRetentionSettings) => {
                        settings.value = updated;
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
