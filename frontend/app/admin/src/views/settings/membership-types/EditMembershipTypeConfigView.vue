<template>
    <SaveView
        :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save"
        v-on="!isNew && deleteHandler ? {delete: doDelete} : {}"
    >
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('shared.startDate')" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox :title="$t('shared.endDate')" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">
            Het is enkel mogelijk om de aansluiting binnen de start- en einddata aan te vragen.
        </p>

        <STInputBox
            v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period"
            :title="$t('admin.settings.membershipTypes.expireDate.title')" error-fields="expireDate"
            :error-box="errors.errorBox"
        >
            <DateSelection
                v-model="expireDate" :required="false"
                :placeholder="$t('admin.settings.membershipTypes.expireDate.placeholder')"
                :time="{hours: 23, minutes: 59, seconds: 59}"
            />
        </STInputBox>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">
            {{ $t('admin.settings.membershipTypes.expireDate.description') }}
        </p>

        <PlatformMembershipTypePriceConfigEdit
            v-for="(priceConfig, index) of prices"
            :key="priceConfig.id"
            :model-value="priceConfig"
            :has-multiple-prices="prices.length > 1"
            :show-start-date="index > 0"
            :show-price-per-day="$showPricePerDay"
            :error-box="errors.errorBox"
            :validator="errors.validator"
            :price-config="priceConfig"
            @update:model-value="patchPrice(priceConfig, $event)"
            @delete="deletePrice(priceConfig)"
        />

        <hr>
        <p>
            <button class="button text" type="button" @click="addPrice">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.period.addPrice') }}</span>
            </button>
        </p>

        <hr>

        <STInputBox title="Gratis per lokale groep" error-fields="price" :error-box="errors.errorBox">
            <NumberInput
                v-model="amountFree" placeholder="Geen"
                :suffix="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dagen' : 'leden'"
                :suffix-singular="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dag' : 'lid'"
            />
        </STInputBox>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import PlatformMembershipTypePriceConfigEdit from './components/PlatformMembershipTypePriceConfigEdit.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    type: PlatformMembershipType;
    config: PlatformMembershipTypeConfig;
    period: RegistrationPeriod
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformMembershipTypeConfig>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => $t('admin.settings.membershipTypes.period.title', {periodName: props.period.name}));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.config);

const $showPricePerDay = computed(() => props.type.behaviour === PlatformMembershipTypeBehaviour.Days);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;

    try {
        if (! await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        const startDateInPeriod = props.period.startDate.getTime() <= patched.value.startDate.getTime() && props.period.endDate.getTime() >= patched.value.startDate.getTime()
        const endDate = patched.value.expireDate || patched.value.endDate
        const endDateInPeriod = props.period.startDate.getTime() <= endDate.getTime() && props.period.endDate.getTime() >= endDate.getTime()

        if (!startDateInPeriod || !endDateInPeriod) {
            throw new SimpleError({
                code: 'invalid_date_range',
                message: 'De aansluitingsperiode moet binnen de periode van het gekozen werkjaar liggen',
                field: 'startDate'
            })
        }

        if (patched.value.expireDate && (patched.value.expireDate.getTime() > patched.value.endDate.getTime() || patched.value.expireDate.getTime() < patched.value.startDate.getTime())) {
            throw new SimpleError({
                code: 'invalid_date_range',
                message: 'De vervaldatum moet tussen de start- en einddatum liggen',
                field: 'expireDate'
            })
        }
        
        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('admin.settings.membershipTypes.period.delete.confirmation.title'), $t('Verwijderen'))) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => addPatch({startDate}),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: (endDate) => addPatch({endDate}),
});

const expireDate = computed({
    get: () => patched.value.expireDate,
    set: (expireDate) => addPatch({expireDate}),
});

const prices = computed({
    get: () => patched.value.prices,
    set: (prices) => addPatch({prices: prices as any}),
});

const amountFree = computed({
    get: () => patched.value.amountFree,
    set: (amountFree) => addPatch({amountFree}),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

function patchPrice(configPrice: PlatformMembershipTypeConfigPrice, patch: PlatformMembershipTypeConfigPrice) {
    prices.value = prices.value.map(p => {
        if (p.id === configPrice.id) {
            return p.patch(patch)
        }
        return p
    }).sort((a, b) => {
        if (!a.startDate) {
            return -1
        }
        if (!b.startDate) {
            return 1
        }
        return a.startDate.getTime() - b.startDate.getTime()
    })
}

function addPrice() {
    prices.value = [...prices.value, PlatformMembershipTypeConfigPrice.create({
        startDate: new Date(),
    })].sort((a, b) => {
        if (!a.startDate) {
            return -1
        }
        if (!b.startDate) {
            return 1
        }
        return a.startDate.getTime() - b.startDate.getTime()
    })
}

function deletePrice(price: PlatformMembershipTypeConfigPrice) {
    prices.value = prices.value.filter(p => p.id !== price.id)
}

defineExpose({
    shouldNavigateAway
})
</script>
