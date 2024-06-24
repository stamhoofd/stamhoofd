<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <h2>{{ $t('shared.general') }}</h2>

        <div class="split-inputs">
            <div>
                <STInputBox :title="$t('admin.organizations.nameLabel')" error-fields="name" :error-box="errors.errorBox">
                    <input
                        id="organization-name"
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        :placeholder="$t('admin.organizations.namePlaceholder')"
                        autocomplete="organization"
                    >
                </STInputBox>

                <AddressInput v-model="address" :title="$t('admin.organizations.addressLabel')" :validator="errors.validator" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('shared.website.optional')" :placeholder="$t('dashboard.inputs.website.placeholder')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    {{ $t('admin.organizations.website.description') }}
                </p>
            </div>
        </div>

        <STInputBox :title="$t('admin.organizations.uri.label')" error-fields="name" :error-box="errors.errorBox">
            <OrganizationUriInput
                v-model="uri"
                :validator="errors.validator"
                :allowValue="props.organization.uri"
            />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('admin.organizations.uri.description') }}
        </p>

        <hr>
        <h2>{{ $t('admin.organizations.tags') }}</h2>
        <STList>
            <SelectOrganizationTagRow v-for="tag in tags" :key="tag.id" :organization="patched" :tag="tag" @patch:organization="addPatch" />
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, useErrors, usePatch, usePlatform, UrlInput, AddressInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Organization } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import SelectOrganizationTagRow from './tags/components/SelectOrganizationTagRow.vue';
import OrganizationUriInput from './components/OrganizationUriInput.vue';
import { Formatter } from '@stamhoofd/utility';
import { SimpleError } from '@simonbackx/simple-errors';

const platform = usePlatform();
const errors = useErrors();
const pop = usePop();

const props = defineProps<{
    organization: Organization,
    isNew: boolean,
    saveHandler: (patch: AutoEncoderPatchType<Organization>) => Promise<void>
}>()

const {patched, hasChanges, addPatch, patch} = usePatch(props.organization)
const $t = useTranslate();

const saving = ref(false);

const title = computed(() => props.isNew ? $t('admin.organizations.new') : $t('admin.organizations.edit'));

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
                message: $t('admin.organizations.errors.nameRequired')
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
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
