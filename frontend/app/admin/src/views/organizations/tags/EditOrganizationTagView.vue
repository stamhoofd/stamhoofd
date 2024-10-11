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
                    <TagRow :tag="item" @click="editTag(item)" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="addTag">
                    <span class="icon add" />
                    <span>{{ $t('Voeg tag toe') }}</span>
                </button>
            </p>
        </div>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                {{ $t('Verwijder deze tag') }}
            </h2>
            <p v-if="!isEmpty" class="style-description">
                {{ $t('Subtags zullen ook verwijderd worden.') }}
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
import { CenteredMessage, ErrorBox, SaveView, useDraggableArrayIds, useErrors } from '@stamhoofd/components';
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
if (props.isNew) {
    patch.value.addPut(props.tag);
}

const allPatchedTags = computed(() => patch.value.applyTo(props.allTags) as OrganizationTag[]);
const patched = computed(() => getPatchedTag(props.tag.id) ?? OrganizationTag.create({ name: 'Onbekende tag' }));

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
        addDeleteRecursive(props.tag.id);
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

function addDeleteRecursive(tagId: string) {
    const tag = getPatchedTag(tagId);

    if (tag) {
        for (const childTagId of tag.childTags) {
            addDeleteRecursive(childTagId);
        }

        addDelete(tagId);
    }
}

function getPatchedTag(tagId: string): OrganizationTag | undefined {
    return allPatchedTags.value.find(t => t.id === tagId);
}

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

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

async function addTag() {
    const tag = OrganizationTag.create({});

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: allPatchedTags.value,
                tag,
                isNew: true,
                saveHandler: (newPatch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    patch.value = patch.value.patch(newPatch);

                    const recordsPatch = new PatchableArray<string, string, string>();
                    recordsPatch.addPut(tag.id);

                    addPatch({ childTags: recordsPatch });
                },
            }),
        ],
    });
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
