<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            {{ $t('Tags helpen bij het filteren van groepen en er kunnen rechten toegekend worden op basis van tags.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-if="draggableTagsWithChildren.length" class="container">
            <hr>
            <h2>{{ $t('Categorieën') }}</h2>
            <p>{{ $t('Organiseer tags door deze onder te verdelen in categorieën.') }}</p>
            <STList v-model="draggableTagsWithChildren" :draggable="true">
                <template #item="{item: tag}">
                    <TagRow :tag="tag" @click="editTag(tag)" />
                </template>
            </STList>
        </div>

        <div class="container">
            <template v-if="draggableTagsWithChildren.length">
                <hr>
                <h2>
                    {{ $t('Andere tags') }}
                </h2>
            </template>
            <STList v-model="draggableOtherTags" :draggable="true">
                <template #item="{item: tag}">
                    <TagRow :tag="tag" @click="editTag(tag)" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="addTag">
                    <span class="icon add" />
                    <span>{{ $t('Tag toevoegen') }}</span>
                </button>
            </p>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { OrganizationTag, Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import TagRow from './components/TagRow.vue';
import EditOrganizationTagView from './EditOrganizationTagView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();

const originalTags = computed(() => platform.value.config.tags);

const { patched: tags, patch, addArrayPatch, hasChanges } = usePatchArray(originalTags);
const saving = ref(false);

const title = 'Tags';

const draggableTagsWithChildren = useDraggableArray(() => tags.value.filter(tag => tag.childTags.length > 0), addArrayPatch);

const draggableOtherTags = useDraggableArray(() => {
    return tags.value.filter(tag => tag.childTags.length === 0 && !tags.value.some(t => t.childTags.includes(tag.id)));
}, addArrayPatch);

async function addTag() {
    const tag = OrganizationTag.create({});

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: tags.value,
                tag,
                isNew: true,
                saveHandler: (patch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    addArrayPatch(patch);
                },
            }),
        ],
    });
}

async function editTag(tag: OrganizationTag) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: tags.value,
                tag,
                isNew: false,
                saveHandler: (newPatch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    addArrayPatch(newPatch);
                },
            }),
        ],
    });
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await platformManager.value.patch(Platform.patch({
            config: PlatformConfig.patch({
                tags: patch.value,
            }),
        }));
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
