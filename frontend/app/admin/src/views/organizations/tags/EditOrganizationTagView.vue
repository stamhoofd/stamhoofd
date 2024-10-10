<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Titel" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze tag"
                autocomplete=""
            >
        </STInputBox>

        <div class="container">
            <hr>
            <h2>{{ $t('Subtags') }}</h2>
            <p class="style-description">
                {{ $t('Groepen met deze subtags hebben automatisch deze tag.') }}
            </p>
            <STList v-model="draggableChildTags" :draggable="true">
                <template #item="{item}">
                    <TagRow :tag="item" :show-delete="true" @click="editTag(item)" @delete="removeChildTag(item.id)" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="selectTags">
                    <span class="icon add" />
                    <span>{{ isEmpty ? $t('Voeg tags toe') : $t('Wijzig tags') }}</span>
                </button>
            </p>
        </div>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                {{ $t('Verwijder deze tag') }}
            </h2>
            <p v-if="!isEmpty" class="style-description">
                {{ $t('Subtags zullen niet verwijderd worden.') }}
            </p>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('Verwijderen') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, OrganizationTagSelectorView, SaveView, useDraggableArrayIds, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { OrganizationTag } from '@stamhoofd/structures';
import { computed, ref, UnwrapNestedRefs } from 'vue';
import TagRow from './components/TagRow.vue';
import EditOrganizationTagView from './EditOrganizationTagView.vue';

const errors = useErrors();
const present = usePresent();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    tag: OrganizationTag;
    allTags: OrganizationTag[];
    isNew: boolean;
    saveHandler: (patches: { tag: OrganizationTag; patch: AutoEncoderPatchType<OrganizationTag> }[]) => Promise<void>;
    deleteHandler: ((tagIds: string[]) => Promise<void>);
}>();

const title = computed(() => props.isNew ? 'Nieuwe tag' : 'Tag bewerken');
const pop = usePop();
const platform = usePlatform();

const { patched, addPatch, hasChanges: hasTagChanges, patch } = usePatch(props.tag);

const deletedTags = ref<string[]>([]);
type UseChildPatchMapValue = UnwrapNestedRefs<ReturnType<typeof usePatch<OrganizationTag>>>;
const useChildPatchMap = ref<Map<string, UseChildPatchMapValue>>(new Map());
const hasChanges = computed(() => {
    if (hasTagChanges.value) {
        return true;
    }

    if (deletedTags.value.length > 0) {
        return true;
    }

    for (const childPatch of useChildPatchMap.value.values()) {
        if (childPatch.hasChanges) {
            return true;
        }
    }

    return false;
});

const allTags = computed(() => props.allTags ?? platform.value.config.tags);
const isEmpty = computed(() => patched.value.childTags.length === 0);
const draggableChildTags = useDraggableArrayIds(
    () => patched.value.childTags.map((id) => {
        const patchedChild = useChildPatchMap.value.get(id);
        if (patchedChild) {
            return patchedChild.patched;
        }
        return allTags.value.find(tag => tag.id === id) ?? OrganizationTag.create({ id, name: 'Onbekende tag' });
    }),
    (patch) => {
        addPatch({ childTags: patch });
    });

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Gelieve een naam in te vullen',
                field: 'name',
            });
        }

        await props.saveHandler([{ tag: props.tag, patch: patch.value }, ...Array.from(useChildPatchMap.value.values()).map(v => ({ tag: v.patched, patch: v.patch }))]);
        if (deletedTags.value.length > 0) {
            await props.deleteHandler(deletedTags.value);
        }

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
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

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze tag wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler([props.tag.id]);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

async function selectTags() {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(OrganizationTagSelectorView, {
                allTags: props.allTags,
                tagIds: patched.value.childTags.slice(),
                filter: (tag: OrganizationTag) => tag.id !== props.tag.id,
                onAdd: async (_allTags: OrganizationTag[], addedTags: OrganizationTag[], deletedTags: OrganizationTag[]) => {
                    const recordsPatch = new PatchableArray<string, string, string>();

                    addedTags.forEach((tag) => {
                        recordsPatch.addPut(tag.id);
                    });

                    deletedTags.forEach((tag) => {
                        recordsPatch.addDelete(tag.id);
                    });

                    addPatch({ childTags: recordsPatch });
                },
            }),
        ],
    });
}

function patchChildTag(tag: OrganizationTag, patch: AutoEncoderPatchType<OrganizationTag>) {
    const id = tag.id;
    let childPatch: UseChildPatchMapValue | undefined = useChildPatchMap.value.get(id);
    if (!childPatch) {
        childPatch = usePatch(tag) as unknown as UseChildPatchMapValue;
        useChildPatchMap.value.set(id, childPatch);
    }

    childPatch.addPatch(patch);
}

async function editTag(tag: OrganizationTag) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: props.allTags,
                tag,
                isNew: false,
                saveHandler: (patches: { tag: OrganizationTag; patch: AutoEncoderPatchType<OrganizationTag> }[]) => patches.forEach(({ tag, patch }) => patchChildTag(tag, patch)),
                deleteHandler: async (tagIds: string[]) => {
                    tagIds.forEach((tagId) => {
                        removeChildTag(tagId);
                        if (!deletedTags.value.includes(tagId)) {
                            deletedTags.value.push(tagId);
                        }
                    });
                },
            }),
        ],
    });
}

function removeChildTag(tagId: string) {
    draggableChildTags.value = draggableChildTags.value.filter(tag => tag.id !== tagId);
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
