<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox :title="$t('6793e0dc-66f0-4a70-b8ac-fb41e2063871')" error-fields="name" :error-box="errors.errorBox">
                    <input
                        id="organization-name"
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        :placeholder="$t('bc8578de-ee3c-4aac-bd19-3fd4040168a4')"
                        autocomplete="organization"
                    >
                </STInputBox>

                <AddressInput v-model="address" :title="$t('74303d1c-2700-4340-816e-03cb9c3fb188')" :validator="errors.validator" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('0e17f20e-e0a6-4fa0-8ec4-378e4325bea5')" :placeholder="$t('5d75775a-a4b5-426a-aea9-b1e75ee5f055')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    {{ $t('5f0e24bb-10db-428b-a480-6f73d959cafa') }}
                </p>
            </div>
        </div>

        <STInputBox :title="$t('2cc5355d-3c19-4a6e-a2c7-1d93e423a8d2')" error-fields="name" :error-box="errors.errorBox">
            <OrganizationUriInput
                v-model="uri"
                :validator="errors.validator"
                :allowValue="props.organization.uri"
            />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('81c91169-db1e-4819-8716-5382ffbaa43b') }}
        </p>

        <hr>
        <h2>{{ $t('0be39baa-0b8e-47a5-bd53-0feeb14a0f93') }}</h2>
        <STList>
            <SelectOrganizationTagRow v-for="tag in tags" :key="tag.id" :organization="patched" :tag="tag" @patch:organization="addPatch" />
        </STList>

        <template v-if="auth.hasFullPlatformAccess()">
            <hr>
            <h2>{{ $t('Actief') }}</h2>
            
            <STList>
                <CheckboxListItem v-model="active" :label="$t('Actief')" description="Leden kunnen geen inactieve groepen vinden of erbij inloggen."/>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { AddressInput, CenteredMessage, CheckboxListItem, ErrorBox, UrlInput, useAuth, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import OrganizationUriInput from './components/OrganizationUriInput.vue';
import SelectOrganizationTagRow from './tags/components/SelectOrganizationTagRow.vue';

const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const auth = useAuth()

const props = defineProps<{
    organization: Organization,
    isNew: boolean,
    saveHandler: (patch: AutoEncoderPatchType<Organization>) => Promise<void>
}>()

const {patched, hasChanges, addPatch, patch} = usePatch(props.organization)
const $t = useTranslate();

const saving = ref(false);

const title = computed(() => props.isNew ? $t('7066aee7-9e51-4767-b288-460646ceca50') : $t('e276e384-22f1-4894-93ae-8874329c6767'));

const name = computed({
    get: () => patched.value.name,
    set: (value) => {
        addPatch({name: value})

        if (props.isNew && !props.organization.uri) {
            addPatch({uri: Formatter.slug(value)})
        }
    }
})

const uri = computed({
    get: () => patched.value.uri,
    set: (value) => addPatch({uri: value})
})

const address = computed({
    get: () => patched.value.address,
    set: (value) => addPatch({address: value})
})

const website = computed({
    get: () => patched.value.website,
    set: (value) => addPatch({website: value})
})

const active = computed({
    get: () => patched.value.active,
    set: (value) => addPatch({active: value})
})

const tags = computed(() => platform.value.config.tags)

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    if (!await errors.validator.validate()) {
        saving.value = false;
        return;
    }

    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'name',
                message: $t('11b55f40-f3d4-4ce7-9831-57d188367b9f')
            })
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'))
}

defineExpose({
    shouldNavigateAway
})
</script>
