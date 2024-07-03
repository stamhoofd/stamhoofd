<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('shared.name') ">
            <input
                v-model="name"
                class="input"
                type="text"
                :placeholder="$t('shared.name') "
            >
        </STInputBox>

        <div class="split-inputs">
            <STInputBox :title="$t('shared.startDate')" error-fields="settings.minAge" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox :title="$t('shared.endDate')" error-fields="settings.maxAge" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

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
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, useErrors, usePatch, DateSelection } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    config: MembershipTypeConfig;
    period: RegistrationPeriod
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<MembershipTypeConfig>) => Promise<void>,
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
        if (name.value.length < 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: $t('shared.errors.name.empty'),
                field: "name"
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

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name}),
});

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => addPatch({startDate}),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: (endDate) => addPatch({endDate}),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
