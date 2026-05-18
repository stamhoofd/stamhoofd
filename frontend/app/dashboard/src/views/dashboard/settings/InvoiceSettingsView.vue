<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`Uitgaande facturen`)" @save="save">
        <h1>
            {{ $t('Uitgaande facutren') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        
        <STList>
            <CheckboxListItem v-model="useResetMonth" :label="$t('Factuurnummers jaarlijks resetten')">
                <div v-if="resetMonth !== null" class="option">
                    <STInputBox :title="$t('Datum waarop nummering wordt gereset')" error-fields="resetMonth" :error-box="errors.errorBox">
                        <Dropdown v-model="resetMonth">
                            <option v-for="t in 12" :key="t" :value="t">
                                {{ resetTextForMonth(t) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
            </CheckboxListItem>

            <CheckboxListItem v-model="prefixYear" :label="$t('Jaarnummer voor factuurnummer toevoegen')" />
        </STList>

        <STInputBox :title="$t('Vaste prefix')" error-fields="fixedPrefix" :error-box="errors.errorBox">
            <input v-model="fixedPrefix" class="input" type="text" autocomplete="off" :placeholder="$t(`Optioneel. bv. 'STA'`)">
        </STInputBox>
        <p class="style-description-small">
            {{ $t('De factuurnummers worden vast voorafgegaan door deze tekst. Vooral handig om meerdere factuurreeksen uit elkaar te houden.') }}
        </p>

        <STInputBox :title="$t('Aantal nullen')" error-fields="fixedPrefix" :error-box="errors.errorBox">
            <NumberInput
                v-model="padZeroLength"
                :min="1" :max="10" :stepper="true" :required="true" :suffix="$t('nullen')" :suffix-singular="$t('nul')" :floating-point="false"
                :auto-fix="false"
            />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('Bv.') }} {{ '123'.padStart(padZeroLength, '0') }}. {{ $t('Dit vult de nummering langs links aan met nullen zodat de nummers altijd dezelfde lengte hebben.') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePatch } from '@stamhoofd/components/hooks/usePatch';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import NumberInput from '@stamhoofd/components/inputs/NumberInput.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { usePatchOrganization } from '@stamhoofd/components/organizations/usePatchOrganization';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { OrganizationPrivateMetaData } from '@stamhoofd/structures';
import { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const organization = useRequiredOrganization();
const dismiss = useDismiss();

const patchOrganization = usePatchOrganization()
const { patched: patchedOrganization, patch: organizationPatch, hasChanges, addPatch, reset: resetPatch } = usePatch(organization);

function resetTextForMonth(index: number) {
    const d = Formatter.luxon().set({month: index, day: 1});
    return Formatter.date(d.toJSDate(), false)
}

const resetMonth = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.resetMonth ?? null,
    set: (resetMonth) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    resetMonth
                })
            })
        })
    }
});

const useResetMonth = computed({
    get: () => resetMonth.value !== null,
    set: (useResetMonth) => {
        const n = resetMonth.value !== null;
        if (useResetMonth === n) {
            return;
        }

        if (useResetMonth) {
            resetMonth.value = 1;
        } else {
            resetMonth.value = null;
        }
    }
})

const padZeroLength = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.padZeroLength ?? 1,
    set: (padZeroLength) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    padZeroLength
                })
            })
        })
    }
});


const prefixYear = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.prefixYear ?? false,
    set: (prefixYear) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    prefixYear
                })
            })
        })
    }
});

const fixedPrefix = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.fixedPrefix ?? '',
    set: (fixedPrefix) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    fixedPrefix
                })
            })
        })
    }
});

async function save() {
    if (saving.value) {
        return;
    }

    const simpleErrors = new SimpleErrors();

    let valid = false;

    if (simpleErrors.errors.length > 0) {
        errors.errorBox = new ErrorBox(errors);
    }
    else {
        errors.errorBox = null;
        valid = true;
    }
    valid = valid && await errors.validator.validate();

    if (!valid) {
        return;
    }

    saving.value = true;

    try {
        await patchOrganization(organizationPatch.value);
        resetPatch();
        Toast.success($t('De wijzigingen zijn opgeslagen')).show();
        dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm({
        title: $t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), 
        confirmText: $t('Niet opslaan')
    });
}

defineExpose({
    shouldNavigateAway,
});
</script>
