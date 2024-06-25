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

        <STInputBox :title="$t('shared.description')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('shared.optional')"
                autocomplete=""
            />
        </STInputBox>

        <hr>
        <h2>Vereisten</h2>

        <div class="split-inputs">
            <STInputBox title="Minimum aantal (optioneel)" error-fields="settings.minAge" :error-box="errors.errorBox">
                <NumberInput v-model="minimumMembers" placeholder="Geen" :required="false" />
            </STInputBox>

            <STInputBox title="Maximum aantal (optioneel)" error-fields="settings.maxAge" :error-box="errors.errorBox">
                <NumberInput v-model="maximumMembers" placeholder="Onbeperkt" :required="false" />
            </STInputBox>
        </div>

        <hr>
        <h2>Zichtbaarheid</h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="assignableByOrganizations" />
                </template>

                <h3 class="style-title-list">
                    Toewijsbaar door beheerders van lokale groepen
                </h3>
                <p v-if="!assignableByOrganizations" class="style-description-small">
                    Enkel beheerders van de koepel kunnen deze functie toekennen als dit uit staat.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('admin.settings.responsibilities.delete.title') }}
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
import { CenteredMessage, ErrorBox, NumberInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberResponsibility } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    responsibility: MemberResponsibility;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<MemberResponsibility>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('admin.settings.responsibilities.new.title') : $t('admin.settings.responsibilities.edit.title'));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.responsibility);

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

    if (!await CenteredMessage.confirm($t('admin.settings.responsibilities.delete.confirmation.title'), $t('shared.delete'), $t('admin.settings.responsibilities.delete.confirmation.description'))) {
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

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description}),
});

const minimumMembers = computed({
    get: () => patched.value.minimumMembers,
    set: (minimumMembers) => addPatch({minimumMembers}),
});

const maximumMembers = computed({
    get: () => patched.value.maximumMembers,
    set: (maximumMembers) => addPatch({maximumMembers}),
});

const assignableByOrganizations = computed({
    get: () => patched.value.assignableByOrganizations,
    set: (assignableByOrganizations) => addPatch({assignableByOrganizations}),
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
