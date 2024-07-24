<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <hr>

        <Checkbox v-model="useRegistrationStartDate">
            {{ $t('Start inschrijvingen pas na een bepaalde datum') }}
        </Checkbox>

        <div v-if="useRegistrationStartDate" class="split-inputs">
            <STInputBox :title="$t('Inschrijven start op')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                <DateSelection v-model="registrationStartDate" />
            </STInputBox>
            <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('Vanaf')" :validator="errors.validator" /> 
        </div>

        <Checkbox v-model="useRegistrationEndDate">
            {{ $t('Sluit inschrijvingen automatisch na een bepaalde datum') }}
        </Checkbox>
                
        <div v-if="useRegistrationEndDate" class="split-inputs">
            <STInputBox :title="$t('Inschrijven sluit op')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                <DateSelection v-model="registrationEndDate" />
            </STInputBox>
            <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('Tot welk tijdstip')" :validator="errors.validator" />
        </div>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                {{ $t('Acties') }}
            </h2>

            <LoadingButton :loading="deleting">
                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('Verwijderen') }}</span>
                </button>
            </LoadingButton>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, GroupSettings, GroupType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import { usePop } from '@simonbackx/vue-app-navigation';
import { DateSelection, TimeInput } from '@stamhoofd/components';

const props = withDefaults(
    defineProps<{
        group: Group;
        isNew: boolean;
        saveHandler: (group: AutoEncoderPatchType<Group>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true
    }
);

const {patched, hasChanges, addPatch, patch} = usePatch(props.group);
const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();

const registrationStartDate = computed({
    get: () => patched.value.settings.registrationStartDate,
    set: (registrationStartDate) => addPatch({
        settings: GroupSettings.patch({
            registrationStartDate
        })
    })
})

const registrationEndDate = computed({
    get: () => patched.value.settings.registrationEndDate,
    set: (registrationEndDate) => addPatch({
        settings: GroupSettings.patch({
            registrationEndDate
        })
    })
})

const useRegistrationStartDate = computed({
    get: () => !!patched.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: props.group.settings.registrationStartDate ?? new Date()
                })
            })
        }
    }
})

const useRegistrationEndDate = computed({
    get: () => !!patched.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: props.group.settings.registrationEndDate ?? new Date()
                })
            })
        }
    }
})

const title = computed(() => {
    if (props.group.type === GroupType.EventRegistration) {
        return props.isNew ? $t('groups.title.new.eventRegistration') :$t('groups.title.edit.eventRegistration');
    }
    return props.isNew ? $t('groups.title.new.membership') : $t('groups.title.edit.membership');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.saved')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(props.group.type === GroupType.EventRegistration ? $t('groups.confirm.delete.eventRegistration') : $t('groups.confirm.delete.membership'), $t('shared.confirmDelete'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.deleted')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        deleting.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})


</script>
