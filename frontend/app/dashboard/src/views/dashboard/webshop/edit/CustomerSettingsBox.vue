<template>
    <EditRecordCategoryRecordsBox v-if="recordEditorSettings" ref="recordsBox" :category="recordCategory" :root-categories="rootCategories" :settings="recordEditorSettings" :allow-child-categories="true" :can-create-root-categories="false" :saved-record-ids="savedRecordIds" @patch="patchRootCategories">
        <template #before>
            <CustomerFieldRow v-for="field of enabledFields" :key="field.key" :model-value="customerSettings[field.key]" :name="field.name" :icon="field.icon" :description="descriptions[field.key]" :fixed="isFixed(field.key)" :data-testid="'customer-field-' + field.key" @update:model-value="setField(field.key, $event)" />
        </template>
    </EditRecordCategoryRecordsBox>
    <STList v-else>
        <CustomerFieldRow v-for="field of enabledFields" :key="field.key" :model-value="customerSettings[field.key]" :name="field.name" :icon="field.icon" :description="descriptions[field.key]" :fixed="isFixed(field.key)" :data-testid="'customer-field-' + field.key" @update:model-value="setField(field.key, $event)" />
    </STList>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import STList from '@stamhoofd/components/layout/STList.vue';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu';
import EditRecordCategoryRecordsBox from '@stamhoofd/components/records/components/EditRecordCategoryRecordsBox.vue';
import type { RecordEditorSettings } from '@stamhoofd/components/records/RecordEditorSettings.ts';
import { getRecordTypeMenuItems } from '@stamhoofd/components/records/recordTypes.ts';
import { RecordCategory, TranslatedString } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerFieldKey } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { computed, useTemplateRef } from 'vue';
import CustomerFieldRow from './CustomerFieldRow.vue';
import { getCustomerFields } from './customerFields';

const props = withDefaults(defineProps<{
    customerSettings: CustomerSettings;
    /**
     * Fields that are always asked: shown with a lock, cannot be changed or removed
     */
    fixedFields?: CustomerFieldKey[];
    descriptions?: Partial<Record<CustomerFieldKey, string>>;
    /**
     * Allows adding extra questions below the built-in fields (stored in `customerSettings.recordCategory`)
     */
    recordEditorSettings?: RecordEditorSettings<any> | null;
    /**
     * Ids of questions that are already saved: their type can no longer change because answers may exist
     */
    savedRecordIds?: Set<string>;
}>(), {
    fixedFields: () => [],
    descriptions: () => ({}),
    recordEditorSettings: null,
    savedRecordIds: () => new Set<string>(),
});

const emit = defineEmits<{
    patch: [patch: AutoEncoderPatchType<CustomerSettings>];
}>();

const fields = getCustomerFields();

const enabledFields = computed(() => fields.filter(field => props.customerSettings[field.key] !== CustomerFieldRequirement.Disabled));
const disabledFields = computed(() => fields.filter(field => props.customerSettings[field.key] === CustomerFieldRequirement.Disabled));

function isFixed(key: CustomerFieldKey) {
    return props.fixedFields.includes(key);
}

function setField(key: CustomerFieldKey, requirement: CustomerFieldRequirement) {
    emit('patch', CustomerSettings.patch({ [key]: requirement }));
}

const recordsBox = useTemplateRef('recordsBox');

/**
 * Something can be added: a built-in field that is not asked yet, or a question
 */
const canAdd = computed(() => disabledFields.value.length > 0 || !!props.recordEditorSettings);

async function showAddMenu(event: MouseEvent) {
    const actions = recordsBox.value;
    const menu = new ContextMenu([
        // A newly added field starts required, the most common choice; the dropdown in the row makes it optional
        disabledFields.value.map(field => new ContextMenuItem({
            name: field.name,
            icon: field.icon,
            action: () => setField(field.key, CustomerFieldRequirement.Required),
        })),
        actions
            ? [
                    // A submenu, so the question types are not confused with the built-in fields above
                    new ContextMenuItem({
                        name: $t('Eigen vraag'),
                        icon: 'text-style',
                        childMenu: new ContextMenu(getRecordTypeMenuItems(type => actions.addRecord(type))),
                    }),
                    new ContextMenuItem({
                        name: $t('%M2'),
                        icon: 'category',
                        action: () => actions.addCategory(),
                    }),
                ]
            : [],
    ]);

    await menu.show({
        button: event.currentTarget as HTMLElement,
        yPlacement: 'bottom',
    });
}

// The extra questions are stored in a single category that is never shown to the user: it is only saved once it contains questions
const emptyRecordCategory = RecordCategory.create({ name: TranslatedString.create($t('Extra vragen')) });
const recordCategory = computed(() => props.customerSettings.recordCategory ?? emptyRecordCategory);
const rootCategories = computed(() => [recordCategory.value]);

function patchRootCategories(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    const [patched] = patch.applyTo(rootCategories.value);
    const isEmpty = !patched || (patched.records.length === 0 && patched.childCategories.length === 0);
    emit('patch', CustomerSettings.patch({ recordCategory: isEmpty ? null : patched }));
}

defineExpose({
    canAdd,
    showAddMenu,
});
</script>
