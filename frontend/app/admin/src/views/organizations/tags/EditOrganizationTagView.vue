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
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, OrganizationTagSelectorView, SaveView, useDraggableArrayIds, useErrors } from '@stamhoofd/components';
import { OrganizationTag } from '@stamhoofd/structures';
import { computed, ref, Ref } from 'vue';
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
    saveHandler: (patch: PatchableArrayAutoEncoder<OrganizationTag>) => Promise<void>;
}>();

const title = computed(() => props.isNew ? 'Nieuwe tag' : 'Tag bewerken');
const pop = usePop();

const patch = ref(new PatchableArray()) as Ref<PatchableArrayAutoEncoder<OrganizationTag>>;
const allPatchedTags = computed(() => patch.value.applyTo(props.allTags) as OrganizationTag[]);
const patched = computed(() => allPatchedTags.value.find(t => t.id === props.tag.id) ?? OrganizationTag.create({ name: 'Onbekende tag' }));
const hasChanges = computed(() => patch.value.changes.length > 0);

function addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationTag>>) {
    patch.value.addPatch((props.tag.static as typeof OrganizationTag).patch({ id: props.tag.id, ...newPatch }));
}

function addDelete(id: string) {
    patch.value.addDelete(id);
}

const isEmpty = computed(() => patched.value.childTags.length === 0);
const draggableChildTags = useDraggableArrayIds(
    () => patched.value.childTags.map(id => allPatchedTags.value.find(patchedTag => patchedTag.id === id)).filter(x => x !== undefined),
    patch => addPatch({ childTags: patch }),
);

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

        await props.saveHandler(patch.value);

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

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze tag wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    deleting.value = true;

    try {
        addDelete(props.tag.id);
        await props.saveHandler(patch.value);
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
                allTags: allPatchedTags.value,
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

async function editTag(tag: OrganizationTag) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: allPatchedTags.value,
                tag,
                isNew: false,
                saveHandler: (newPatch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    patch.value = patch.value.patch(newPatch);
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
