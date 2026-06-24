<template>
    <SaveView :title="$t('Instellingen kopiëren')" :save-text="$t('Kopiëren')" :disabled="selectedIds.size === 0" @save="save">
        <h1>{{ $t('Instellingen kopiëren') }}</h1>
        <p>{{ $t('Selecteer naar welke kortingscodes je de instellingen van {code} wilt kopiëren. De codes zelf blijven ongewijzigd.', { code: discountCode.code }) }}</p>

        <div v-if="candidates.length > 5" class="input-with-buttons">
            <div>
                <form class="input-icon-container icon search gray" @submit.prevent>
                    <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`Zoeken`)">
                </form>
            </div>
            <div>
                <button type="button" class="button text" @click="editFilter">
                    <span class="icon filter" />
                    <span class="hide-small">{{ $t('Filter') }}</span>
                    <span v-if="hasActiveFilter" class="icon dot primary" />
                </button>
            </div>
        </div>

        <STList v-if="filteredCandidates.length">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="allSelected" :indeterminate="someSelected && !allSelected" @update:model-value="toggleAll" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Alles selecteren') }}
                </h3>
            </STListItem>

            <STListItem v-for="code of filteredCandidates" :key="code.id" class="left-center" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="selectedIds.has(code.id)" @update:model-value="(value: boolean) => toggle(code.id, value)" />
                </template>

                <h3 class="style-title-list">
                    <span class="style-discount-code">{{ code.code }}</span>
                </h3>
                <p v-if="code.description" class="style-description-small">
                    {{ code.description }}
                </p>
            </STListItem>
        </STList>

        <p v-else-if="candidates.length === 0" class="info-box">
            {{ $t('Er zijn geen andere kortingscodes om de instellingen naar te kopiëren.') }}
        </p>
        <p v-else class="info-box">
            {{ $t('Geen kortingscodes gevonden voor deze zoekopdracht.') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import type { Discount } from '@stamhoofd/structures';
import { DiscountCode } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { computed, ref } from 'vue';
import { useDiscountCodeFilter } from './useDiscountCodeFilter';

const props = defineProps<{
    discountCode: DiscountCode;
    discountCodes: DiscountCode[];
    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => void;
}>();

const pop = usePop();
const selectedIds = ref<Set<string>>(new Set());

const { searchQuery, hasActiveFilter, filterCodes, editFilter } = useDiscountCodeFilter();

const candidates = computed(() => props.discountCodes.filter(c => c.id !== props.discountCode.id));
const filteredCandidates = computed(() => filterCodes(candidates.value));

const allSelected = computed(() => filteredCandidates.value.length > 0 && filteredCandidates.value.every(c => selectedIds.value.has(c.id)));
const someSelected = computed(() => filteredCandidates.value.some(c => selectedIds.value.has(c.id)));

function toggle(id: string, value: boolean) {
    const next = new Set(selectedIds.value);
    if (value) {
        next.add(id);
    } else {
        next.delete(id);
    }
    selectedIds.value = next;
}

function toggleAll(value: boolean) {
    const next = new Set(selectedIds.value);
    for (const c of filteredCandidates.value) {
        if (value) {
            next.add(c.id);
        } else {
            next.delete(c.id);
        }
    }
    selectedIds.value = next;
}

function save() {
    const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();

    for (const target of candidates.value) {
        if (!selectedIds.value.has(target.id)) {
            continue;
        }

        // Replace the target's discounts with a copy of the source's discounts (new ids).
        const discounts = new PatchableArray() as PatchableArrayAutoEncoder<Discount>;
        for (const existing of target.discounts) {
            discounts.addDelete(existing.id);
        }
        for (const discount of props.discountCode.discounts) {
            const cloned = discount.clone();
            cloned.id = uuidv4();
            discounts.addPut(cloned);
        }

        arr.addPatch(DiscountCode.patch({
            id: target.id,
            description: props.discountCode.description,
            maximumUsage: props.discountCode.maximumUsage,
            discounts,
        }));
    }

    props.saveHandler(arr);
    pop({ force: true })?.catch(console.error);
}
</script>
