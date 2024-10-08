<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTags" :draggable="true">
            <template #item="{item: tag}">
                <TagRow :tag="tag" @click="editTag(tag)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addTag">
                <span class="icon add" />
                <span>Tag toevoegen</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { computed, ref } from 'vue';
import EditOrganizationTagView from './EditOrganizationTagView.vue';
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { OrganizationTag, Platform, PlatformConfig } from '@stamhoofd/structures';
import TagRow from './components/TagRow.vue';
import { usePlatformManager } from '@stamhoofd/networking';
import { useTranslate } from '@stamhoofd/frontend-i18n';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();

const originalTags = computed(() => platform.value.config.tags);
const { patched: tags, patch, addArrayPatch, hasChanges } = usePatchArray(originalTags);
const draggableTags = useDraggableArray(() => tags.value, addArrayPatch);
const saving = ref(false);

const title = 'Tags';

async function addTag() {
    const arr: PatchableArrayAutoEncoder<OrganizationTag> = new PatchableArray();
    const tag = OrganizationTag.create({});
    arr.addPut(tag);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                tag,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationTag>) => {
                    patch.id = tag.id;
                    arr.addPatch(patch);
                    addArrayPatch(arr);
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
                tag,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationTag>) => {
                    const arr: PatchableArrayAutoEncoder<OrganizationTag> = new PatchableArray();
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<OrganizationTag> = new PatchableArray();
                    arr.addDelete(tag.id);
                    addArrayPatch(arr);
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
