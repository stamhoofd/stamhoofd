<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%1Tp`)" @save="save">
        <h1>
            {{ $t('%1Rg') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        
        <STList>
            <CheckboxListItem v-model="useResetMonth" :label="$t('%1R0')">
                <div v-if="resetMonth !== null" class="option">
                    <STInputBox :title="$t('%1Rf')" error-fields="resetMonth" :error-box="errors.errorBox">
                        <Dropdown v-model="resetMonth">
                            <option v-for="t in 12" :key="t" :value="t">
                                {{ resetTextForMonth(t) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
            </CheckboxListItem>

            <CheckboxListItem v-model="prefixYear" :label="$t('%1UK')" />
        </STList>

        <STInputBox :title="$t('%1Ru')" error-fields="fixedPrefix" :error-box="errors.errorBox">
            <input v-model="fixedPrefix" class="input" type="text" autocomplete="off" :placeholder="$t(`%1Sx`)">
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%1Rw') }}
        </p>

        <STInputBox :title="$t('%1QX')" error-fields="fixedPrefix" :error-box="errors.errorBox">
            <NumberInput
                v-model="padZeroLength"
                :min="1" :max="10" :stepper="true" :required="true" :suffix="$t('%1S5')" :suffix-singular="$t('%1SA')" :floating-point="false"
                :auto-fix="false"
            />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%1Sd') }} {{ '123'.padStart(padZeroLength, '0') }}. {{ $t('%1Sq') }}
        </p>

        <div class="split-inputs">
            <div>
                <ImageInput v-model="background" :validator="errors.validator" :resolutions="resolutions" :required="false" :title="$t(`%1QM`)" />
            </div>

            <div v-if="background">
                <ImageInput v-model="secondBackground" :placeholder="background" :validator="errors.validator" :resolutions="resolutions" :required="false" :title="$t(`%1SX`)" />
            </div>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ImageInput } from '@stamhoofd/components';
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
import { OrganizationPrivateMetaData, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const organization = useRequiredOrganization();
const dismiss = useDismiss();

const patchOrganization = usePatchOrganization()
const { patched: patchedOrganization, patch: organizationPatch, hasChanges, addPatch, reset: resetPatch } = usePatch(organization);

const resolutions = [
    ResolutionRequest.create({
        height: 3508,
        width: 2480,
        fit: ResolutionFit.Outside,
    }),
]

function resetTextForMonth(index: number) {
    const d = Formatter.luxon().set({month: index, day: 1});
    return Formatter.date(d.toJSDate(), false)
}

const background = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.background ?? null,
    set: (background) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    background
                })
            })
        })
    }
});

const secondBackground = computed({
    get: () => patchedOrganization.value.privateMeta?.invoiceSettings.secondBackground ?? null,
    set: (secondBackground) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                invoiceSettings: OrganizationInvoiceSettings.patch({
                    secondBackground
                })
            })
        })
    }
});

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
        Toast.success($t('%HA')).show();
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
        title: $t('%A0'), 
        confirmText: $t('%4X')
    });
}

defineExpose({
    shouldNavigateAway,
});
</script>
