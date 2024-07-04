<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('shared.startDate')" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox :title="$t('shared.endDate')" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">
            Het is enkel mogelijk om de aansluiting binnen de start- en einddata aan te vragen.
        </p>

        <STInputBox v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" :title="$t('admin.settings.membershipTypes.expireDate.title')" error-fields="endDate" :error-box="errors.errorBox">
            <DateSelection v-model="expireDate" :required="false" :placeholder="$t('admin.settings.membershipTypes.expireDate.placeholder')" />
        </STInputBox>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">
            {{ $t('admin.settings.membershipTypes.expireDate.description') }}
        </p>

        <div v-for="(price, index) of prices" :key="price.id" class="container">
            <hr>

            <template v-if="prices.length > 1">
                <h2 v-if="index === 0 || !price.startDate">
                    Standaardprijs
                </h2>
                <h2 v-else class="style-with-button">
                    <div>
                        Prijs vanaf {{ formatDate(price.startDate) }}
                    </div>
                    <div>
                        <button class="button text" type="button" @click="deletePrice(price)">
                            <span class="icon trash" />
                            <span class="hide-smartphone">{{ $t('shared.delete') }}</span>
                        </button>
                    </div>
                </h2>
            </template>

            <STInputBox v-if="index > 0 || price.startDate" :title="$t('admin.settings.membershipTypes.period.priceDate')" :error-box="errors.errorBox">
                <DateSelection :model-value="price.startDate" :required="false" :placeholder="$t('admin.settings.membershipTypes.expireDate.placeholder')" @update:model-value="patchPrice(price, {startDate: $event})" />
            </STInputBox>

            <div class="split-inputs">
                <STInputBox v-if="type.behaviour === PlatformMembershipTypeBehaviour.Days || price.pricePerDay" title="Prijs per dag" :error-box="errors.errorBox">
                    <PriceInput :model-value="price.pricePerDay" placeholder="Prijs per dag" @update:model-value="patchPrice(price, {pricePerDay: $event})" />
                </STInputBox>

                <STInputBox :title="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'Vaste prijs' : 'Prijs'" :error-box="errors.errorBox">
                    <PriceInput :model-value="price.price" placeholder="Gratis" @update:model-value="patchPrice(price, {price: $event})" />
                </STInputBox>
            </div>
        </div>

        <p>
            <button class="button text" type="button" @click="addPrice">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.period.addPrice') }}</span>
            </button>
        </p>

        <hr>

        <STInputBox title="Gratis per lokale groep" error-fields="price" :error-box="errors.errorBox">
            <NumberInput v-model="amountFree" placeholder="Geen" :suffix="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dagen' : 'leden'" :suffix-singular="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dag' : 'lid'" />
        </STInputBox>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('shared.actions') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('shared.delete') }}</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, PriceInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

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

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
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

    if (!await CenteredMessage.confirm($t('admin.settings.membershipTypes.period.delete.confirmation.title'), $t('shared.delete'))) {
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
    
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

function patchPrice(configPrice: PlatformMembershipTypeConfigPrice, patch: PartialWithoutMethods<AutoEncoderPatchType<PlatformMembershipTypeConfigPrice>>) {
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
