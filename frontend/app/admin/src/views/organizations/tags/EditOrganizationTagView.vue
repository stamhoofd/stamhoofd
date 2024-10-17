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
            <h2>{{ $t('b381ed6f-c509-418d-9668-7c161a0fa652') }}</h2>
            <p class="style-description">
                {{ $t('4139ef30-55c8-4775-b97a-69b3a8b7d112') }}
            </p>
            <STList v-model="draggableChildTags" :draggable="true">
                <template #item="{item}">
                    <TagRow :all-tags="allTags" :tag="item" @click="editTag(item)" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="addTag">
                    <span class="icon add" />
                    <span>{{ $t('20699886-7112-43f5-b38c-f5b686c37257') }}</span>
                </button>
            </p>
        </div>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                {{ $t('e5c15476-6092-45c9-ac55-541f45720c71') }}
            </h2>
            <p v-if="!isEmpty" class="style-description">
                {{ $t('ceaaf7f7-900e-497e-91f5-16c3a173b7bf') }}
            </p>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('5bb7b4d5-def0-431d-ba3c-e34ffc7ee777') }}</span>
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
