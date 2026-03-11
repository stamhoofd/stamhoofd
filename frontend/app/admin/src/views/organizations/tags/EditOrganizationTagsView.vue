<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>{{ $t('%H8') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTags" :draggable="true">
            <template #item="{item: tag}">
                <TagRow :tag="tag" :all-tags="tags" @click="editTag(tag)" @patch:all-tags="addArrayPatch" />
            </template>
        </STList>
        <p>
            <button class="button text" type="button" @click="addTag">
                <span class="icon add" />
                <span>{{ $t('%73') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { OrganizationTag, Platform, PlatformConfig, TagHelper } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import TagRow from './components/TagRow.vue';
import EditOrganizationTagView from './EditOrganizationTagView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();

const originalTags = computed(() => platform.value.config.tags);

const { patched: tags, patch, addArrayPatch, hasChanges } = usePatchArray(originalTags);
const saving = ref(false);

const title = $t(`%H9`);

const draggableTags = useDraggableArray(() => TagHelper.getRootTags(tags.value), addArrayPatch);

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
        new Toast($t(`%HA`), 'success green').show();
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

defineExpose({
    shouldNavigateAway,
});
</script>
