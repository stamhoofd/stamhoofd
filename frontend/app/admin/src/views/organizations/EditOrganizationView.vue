<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox :title="$t('%3C')" error-fields="name" :error-box="errors.errorBox">
                    <input id="organization-name" ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('%3D')" autocomplete="organization">
                </STInputBox>

                <AddressInput v-model="address" :optional-except-city="STAMHOOFD.userMode !== 'platform'" :title="$t('%33')" :validator="errors.validator" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('%5I')" :placeholder="$t('%2n')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    {{ $t('%3H') }}
                </p>
            </div>
        </div>

        <STInputBox :title="$t('%5')" error-fields="name" :error-box="errors.errorBox">
            <OrganizationUriInput v-model="uri" :validator="errors.validator" :allow-value="props.organization.uri" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%4') }}
        </p>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr><FillRecordCategoryBox :category="category" :value="patched" :validator="errors.validator" :level="2" :all-optional="true" :force-mark-reviewed="false" @patch="patchAnswers" />
        </div>

        <hr><h2>{{ $t('%3G') }}</h2>
        <STList>
            <SelectOrganizationTagRow v-for="tag in rootTags" :key="tag.id" :organization="patched" :tag="tag" @patch:organization="addPatch" />
        </STList>

        <div v-for="tag in allTagsWithChildren" :key="tag.id" class="container">
            <JumpToContainer :visible="isSelected(tag)">
                <hr><h2>{{ $t('%3G') }} → {{ tag.name }}</h2>
                <STList>
                    <SelectOrganizationTagRow v-for="childTag in tagIdsToTags(tag.childTags)" :key="childTag.id" :organization="patched" :tag="childTag" @patch:organization="addPatch" />
                </STList>
            </JumpToContainer>
        </div>

        <template v-if="auth.hasFullPlatformAccess()">
            <hr><h2>{{ $t('%1H0') }}</h2>

            <STList>
                <CheckboxListItem v-model="active" :label="$t('%1H0')" :description="$t(`%Gj`)" />
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import JumpToContainer from '@stamhoofd/components/containers/JumpToContainer.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import UrlInput from '@stamhoofd/components/inputs/UrlInput.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import type { Organization, OrganizationTag, PatchAnswers} from '@stamhoofd/structures';
import { OrganizationMetaData, OrganizationPrivateMetaData, TagHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import OrganizationUriInput from './components/OrganizationUriInput.vue';
import SelectOrganizationTagRow from './tags/components/SelectOrganizationTagRow.vue';

const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const auth = useAuth();

const props = defineProps<{
    organization: Organization;
    isNew: boolean;
    saveHandler: (patch: AutoEncoderPatchType<Organization>) => Promise<void>;
}>();

const { patched, hasChanges, addPatch, patch } = usePatch(props.organization);

const platformManager = usePlatformManager();

const saving = ref(false);

const title = computed(() => props.isNew ? $t('%3E') : $t('%38'));

const name = computed({
    get: () => patched.value.name,
    set: (value) => {
        addPatch({ name: value });

        if (props.isNew && !props.organization.uri) {
            addPatch({ uri: Formatter.slug(value) });
        }
    },
});

const uri = computed({
    get: () => patched.value.uri,
    set: value => addPatch({ uri: value }),
});

const address = computed({
    get: () => patched.value.address,
    set: value => addPatch({ address: value }),
});

const website = computed({
    get: () => patched.value.website,
    set: value => addPatch({ website: value }),
});

const active = computed({
    get: () => patched.value.active,
    set: value => addPatch({ active: value }),
});

function patchAnswers(patch: PatchAnswers) {
    addPatch({
        privateMeta: OrganizationPrivateMetaData.patch({ recordAnswers: patch }),
    });
}

const recordCategories = computed(() =>
    platform.value.config.organizationLevelRecordsConfiguration.getEnabledCategories(patched.value),
);

const platformTags = computed(() => platform.value.config.tags);
const rootTags = computed(() => TagHelper.getRootTags(platformTags.value));
const selectedTagIds = computed(() => patched.value.meta.tags);
const selectedTags = computed(() => tagIdsToTags(selectedTagIds.value));
const allTagsWithChildren = computed(() => platformTags.value.filter(tag => tag.childTags.length > 0));
const selectedTagsWithChildren = computed(() => selectedTags.value.filter(tag => tag.childTags.length > 0));

watch(() => selectedTagsWithChildren.value, (selectedTagsWithChildren) => {
    const tagIds = selectedTagIds.value;

    // delete tags that are subtags of tags that are not selected
    const tagsToDelete = tagIds.filter(tagId =>
        !(rootTags.value.some(rootTag => rootTag.id === tagId)
            || selectedTagsWithChildren.some(tagWithChildren => tagWithChildren.childTags.includes(tagId))
        ));

    if (tagsToDelete.length > 0) {
        setTagIds(tagIds.filter(id => !tagsToDelete.includes(id)));
    }
}, { immediate: true });

function isSelected(tag: OrganizationTag): boolean {
    return selectedTagIds.value.includes(tag.id);
}

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
                message: $t('%3A'),
            });
        }
        await props.saveHandler(patch.value);

        // Reload platform in the background
        await platformManager.value.forceUpdate();

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

function tagIdsToTags(ids: string[]) {
    return ids.map(id => platformTags.value.find(pt => pt.id === id)).filter(x => x !== undefined);
}

function setTagIds(tagIds: string[]) {
    addPatch({
        meta: OrganizationMetaData.patch({
            tags: tagIds as any,
        }),
    });
}

defineExpose({
    shouldNavigateAway,
});
</script>
