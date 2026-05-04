<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Type" error-fields="type" :error-box="errors.errorBox">
            <Dropdown v-model="type">
                <option v-for="t in Object.values(STPackageType)" :key="t" :value="t">
                    {{ STPackageTypeHelper.getName(t) }}
                </option>
            </Dropdown>
        </STInputBox>

        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="settings.startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" title="Vanaf welk tijdstip" :validator="errors.validator" /> 
        </div>

        <Checkbox v-model="enableValidUntil">
            Einddatum toevoegen
        </Checkbox>

        <div v-if="validUntil !== null" class="split-inputs">
            <STInputBox title="Einddatum" error-fields="settings.validUntil" :error-box="errors.errorBox">
                <DateSelection v-model="validUntil" />
            </STInputBox>
            <TimeInput v-model="validUntil" title="Tot welk tijdstip" :validator="errors.validator" />
        </div>

        <Checkbox v-model="enableRemoveAt">
            Vervaldatum toevoegen
        </Checkbox>

        <div v-if="removeAt !== null" class="split-inputs">
            <STInputBox title="Vervaldatum" error-fields="settings.removeAt" :error-box="errors.errorBox">
                <DateSelection v-model="removeAt" />
            </STInputBox>
            <TimeInput v-model="removeAt" title="Tot welk tijdstip" :validator="errors.validator" />
        </div>
        <p v-if="removeAt !== null" class="style-description-small">
            Verlengen is nog mogelijk tot aan de vervaldatum. Het pakket blijft ook zichtbaar tot aan de vervaldatum
        </p>

        <Checkbox v-model="allowRenew">
            Verlengbaar
        </Checkbox>
        <Checkbox v-model="canDeactivate">
            Opzegbaar
        </Checkbox>

        <hr>
        <h2>Servicekosten</h2>

        <div class="split-inputs">
            <STInputBox title="Vast bedrag" error-fields="serviceFeeFixed" :error-box="errors.errorBox">
                <PriceInput v-model="serviceFeeFixed" />
            </STInputBox>

            <STInputBox title="Procentueel" error-fields="serviceFeePercentage" :error-box="errors.errorBox">
                <PermyriadInput v-model="serviceFeePercentage" />
            </STInputBox>
        </div>

        <div class="split-inputs">
            <STInputBox title="Minimum servicekost" error-fields="serviceFeeMinimum" :error-box="errors.errorBox">
                <PriceInput v-model="serviceFeeMinimum" :required="false" placeholder="Geen" />
            </STInputBox>

            <STInputBox title="Maximum servicekost" error-fields="serviceFeeMaximum" :error-box="errors.errorBox">
                <PriceInput v-model="serviceFeeMaximum" :required="false" placeholder="Geen" />
            </STInputBox>
        </div>

        <hr>
        <h2>Fixed costs (legacy)</h2>

        <div class="split-inputs">
            <STInputBox title="Prijs" error-fields="unitPrice" :error-box="errors.errorBox">
                <PriceInput v-model="unitPrice" />
            </STInputBox>
            <STInputBox title="Prijs type" error-fields="pricingType" :error-box="errors.errorBox">
                <Dropdown v-model="pricingType">
                    <option v-for="type in Object.values(STPricingType)" :key="type" :value="type">
                        {{ getPricingTypeName(type) }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox title="Minimum aantal stuks" error-fields="minimumAmount" :error-box="errors.errorBox">
            <NumberInput v-model="minimumAmount" />
        </STInputBox>

        <hr>
        <h2>Mislukte betalingen</h2>

        <Checkbox v-model="enableFailedPayment">
            Mislukte betaling toevoegen
        </Checkbox>

        <div v-if="firstFailedPayment !== null" class="split-inputs">
            <STInputBox title="Eerste mislukte betaling" error-fields="settings.endDate" :error-box="errors.errorBox">
                <DateSelection v-model="firstFailedPayment" />
            </STInputBox>
            <TimeInput v-model="firstFailedPayment" title="Tot welk tijdstip" :validator="errors.validator" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { STPackage, STPackageMeta, STPackageType, STPackageTypeHelper, STPricingType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import PermyriadInput from '@stamhoofd/components/inputs/PermyriadInput.vue';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';

const props = defineProps<{
    pack: STPackage;
    isNew: boolean;
    saveHandler: ((patch: AutoEncoderPatchType<STPackage>) => Promise<void>);
}>();

const { hasChanges, addPatch, patch, patched: patchedPackage } = usePatch(props.pack);
const loading = ref(false);
const errors = useErrors();
const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t(`Nieuw pakket`) : $t(`Pakket bewerken`);
});

const type = computed({
    get: () => patchedPackage.value.meta.type,
    set: (type) => {
        addPatch({
            meta: STPackageMeta.patch({
                type
            })
        })
    }
});

const startDate = computed({
    get: () => patchedPackage.value.meta.startDate,
    set: (startDate) => {
        addPatch({
            meta: STPackageMeta.patch({
                startDate
            })
        })
    }
});

const validUntil = computed({
    get: () => patchedPackage.value.validUntil,
    set: (validUntil) => {
        addPatch({
            validUntil
        })
    }
});

const enableValidUntil = computed({
    get: () => !!validUntil.value,
    set: (enabled) => {
        if (!enabled) {
            validUntil.value = null;
            return;
        }
        validUntil.value = props.pack.validUntil ?? new Date()
    }
})

const removeAt = computed({
    get: () => patchedPackage.value.removeAt,
    set: (removeAt) => {
        addPatch({
            removeAt
        })
    }
});

const enableRemoveAt = computed({
    get: () => !!removeAt.value,
    set: (enabled) => {
        if (!enabled) {
            removeAt.value = null;
            return;
        }
        removeAt.value = props.pack.removeAt ?? new Date()
    }
})

const allowRenew = computed({
    get: () => patchedPackage.value.meta.allowRenew,
    set: (allowRenew) => {
        addPatch({
            meta: STPackageMeta.patch({
                allowRenew
            })
        })
    }
});

const canDeactivate = computed({
    get: () => patchedPackage.value.meta.canDeactivate,
    set: (canDeactivate) => {
        addPatch({
            meta: STPackageMeta.patch({
                canDeactivate
            })
        })
    }
});

const serviceFeeFixed = computed({
    get: () => patchedPackage.value.meta.serviceFeeFixed,
    set: (serviceFeeFixed) => {
        addPatch({
            meta: STPackageMeta.patch({
                serviceFeeFixed
            })
        })
    }
});

const serviceFeePercentage = computed({
    get: () => patchedPackage.value.meta.serviceFeePercentage,
    set: (serviceFeePercentage) => {
        addPatch({
            meta: STPackageMeta.patch({
                serviceFeePercentage
            })
        })
    }
});

const serviceFeeMinimum = computed({
    get: () => patchedPackage.value.meta.serviceFeeMinimum,
    set: (serviceFeeMinimum) => {
        addPatch({
            meta: STPackageMeta.patch({
                serviceFeeMinimum
            })
        })
    }
});

const serviceFeeMaximum = computed({
    get: () => patchedPackage.value.meta.serviceFeeMaximum,
    set: (serviceFeeMaximum) => {
        addPatch({
            meta: STPackageMeta.patch({
                serviceFeeMaximum
            })
        })
    }
});

const unitPrice = computed({
    get: () => patchedPackage.value.meta.unitPrice,
    set: (unitPrice) => {
        addPatch({
            meta: STPackageMeta.patch({
                unitPrice
            })
        })
    }
});

const pricingType = computed({
    get: () => patchedPackage.value.meta.pricingType,
    set: (pricingType) => {
        addPatch({
            meta: STPackageMeta.patch({
                pricingType
            })
        })
    }
});
const minimumAmount = computed({
    get: () => patchedPackage.value.meta.minimumAmount,
    set: (minimumAmount) => {
        addPatch({
            meta: STPackageMeta.patch({
                minimumAmount
            })
        })
    }
});



const firstFailedPayment = computed({
    get: () => patchedPackage.value.meta.firstFailedPayment,
    set: (firstFailedPayment) => {
        addPatch({
            meta: STPackageMeta.patch({
                firstFailedPayment
            })
        })
    }
});

const enableFailedPayment = computed({
    get: () => firstFailedPayment.value !== null,
    set: (enable) => {
        if (enable === enableFailedPayment.value) {
            return
        }
        if (enable) {
            firstFailedPayment.value = new Date()
            addPatch(STPackage.patch({
                meta: STPackageMeta.patch({
                    paymentFailedCount: Math.max(patchedPackage.value.meta.paymentFailedCount, 1)
                })
            }))

        } else {
            firstFailedPayment.value = null
            addPatch(STPackage.patch({
                meta: STPackageMeta.patch({
                    paymentFailedCount: 0
                })
            }))
        }
    }
});

function getPricingTypeName(type: STPricingType) {
    switch (type) {
        case STPricingType.Fixed: return "Eénmalig"
        case STPricingType.PerYear: return "Per jaar"
        case STPricingType.PerMember: return "Per lid, per jaar"
    }
}

async function save() {
    if (loading.value) {
        return;
    }
    errors.errorBox = null;
    loading.value = true;

    try {
        const valid = await errors.validator.validate();
        if (!valid) {
            loading.value = false;
            return;
        }
        
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doDelete() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`Dit pakket deactiveren?`), $t(`%CJ`), $t(`%1Fc`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await props.saveHandler(STPackage.patch({
            removeAt: new Date()
        }));
        Toast.success($t('Dit pakket werd gedeactiveerd')).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
