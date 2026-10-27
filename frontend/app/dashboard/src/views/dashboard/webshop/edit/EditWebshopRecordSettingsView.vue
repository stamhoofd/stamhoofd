<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="title" @save="save">
        <template #buttons>
            <button v-if="customerSettingsBox?.canAdd" class="button text only-icon-smartphone" type="button" data-testid="customer-settings-add-button" @click="customerSettingsBox?.showAddMenu($event)">
                <span class="icon add" />
                <span>{{ $t('%SN') }}</span>
            </button>
            <button v-tooltip="$t('%jH')" class="button icon eye" type="button" data-testid="customer-settings-preview-button" @click="showExample" />
        </template>
        <h1>
            {{ title }}
        </h1>
        <p v-if="showParticipantSettings">
            {{ webshop.meta.isRegistrations ? $t('Kies welke gegevens iemand invult bij het inschrijven.') : $t('Kies welke gegevens bestellers invullen.') }}
        </p>
        <p v-else>
            {{ $t('%Rk') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="showParticipantSettings">
            <ParticipantSettingsBox :webshop="webshop" :original-webshop="originalWebshop" @patch="addPatch" />

            <hr>
            <h2>{{ $t('Gegevens van de besteller') }}</h2>
            <p>
                {{ webshop.products.some(p => p.enableCustomer) ? $t('Wordt één keer per bestelling gevraagd. Is de besteller zelf een deelnemer, dan worden die gegevens overgenomen.') : $t('Wordt één keer per bestelling gevraagd.') }}
            </p>
        </template>

        <CustomerSettingsBox ref="customerSettingsBox" :customer-settings="webshop.meta.customerSettings" :fixed-fields="['name', 'email']" :record-editor-settings="editorSettings" :saved-record-ids="savedCustomerRecordIds" @patch="patchCustomerSettings" />

        <hr>
        <h2>{{ $t('Extra stappen') }}</h2>

        <p>
            {{ $t('Voeg extra stappen toe aan het afrekenen, elk met hun eigen vragen. Een stap kan je enkel in bepaalde gevallen tonen.') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%19t') }}</a>
        </p>

        <EditRecordCategoriesBox :categories="categories" :settings="editorSettings" :add-text="$t('Nieuwe stap')" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useCheckoutInMemoryFilterBuilders } from '@stamhoofd/components/filters/filter-builders/checkout.ts';
import { GroupUIFilterBuilder } from '@stamhoofd/components/filters/GroupUIFilter.ts';
import { useFeatureFlagComputed } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import EditRecordCategoriesBox from '@stamhoofd/components/records/components/EditRecordCategoriesBox.vue';
import { RecordEditorSettings, RecordEditorType } from '@stamhoofd/components/records/RecordEditorSettings.ts';
import type { RecordCategory } from '@stamhoofd/structures';
import { Checkout, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { computed, useTemplateRef } from 'vue';
import CustomerSettingsBox from './CustomerSettingsBox.vue';
import ParticipantSettingsBox from './ParticipantSettingsBox.vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, originalWebshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});

const savedCustomerRecordIds = new Set(originalWebshop.meta.customerSettings.recordCategory?.getAllRecords().map(r => r.id) ?? []);

const categories = computed(() => webshop.value.meta.recordCategories);
const customerSettingsBox = useTemplateRef('customerSettingsBox');
const title = computed(() => webshop.value.meta.isRegistrations ? $t('Inschrijvingsformulier') : $t('Bestelformulier'));
const modernWebshopEnabled = useFeatureFlagComputed('modern-webshop');

// Only where a piece is usually for one person: elsewhere details per order are the norm (e.g. 5× a meal on one name)
const showParticipantSettings = computed(() => modernWebshopEnabled.value && (webshop.value.meta.isTicketBased || webshop.value.meta.isRegistrations));
const present = usePresent();

function patchCustomerSettings(patch: AutoEncoderPatchType<CustomerSettings>) {
    addPatch(PrivateWebshop.patch({
        meta: WebshopMetaData.patch({
            customerSettings: patch,
        }),
    }));
}

const getCheckoutFilterDefinitions = useCheckoutInMemoryFilterBuilders();

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        type: RecordEditorType.Webshop,
        dataPermission: false,
        filterBuilder: (categories: RecordCategory[]) => {
            if (!props.webshopManager?.webshop) {
                return new GroupUIFilterBuilder({
                    builders: [],
                });
            }
            return getCheckoutFilterDefinitions(webshop.value, categories)[0];
        },
        exampleValue: Checkout.create({}),
    });
});

async function showExample() {
    await present({
        components: [
            AsyncComponent(() => import('./CustomerSettingsPreviewView.vue'), {
                webshop: webshop.value,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch(PrivateWebshop.patch({
        meta: WebshopMetaData.patch({
            recordCategories: patch,
        }),
    }));
}

defineExpose({
    shouldNavigateAway,
});
</script>
