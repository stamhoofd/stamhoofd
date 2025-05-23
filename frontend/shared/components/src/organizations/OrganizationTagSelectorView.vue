<template>
    <SaveView :title="title" :disabled="!$hasChanges" :save-text="$saveText" @save="save">
        <h1>{{ title }}<span v-show="$selectedTags.size > 0" class="selection-count">{{ " (" + $selectedTags.size + ")" }}</span></h1>
        <form class="search-box input-icon-container icon search gray" @submit.prevent>
            <input ref="input" v-model="$searchString" :autofocus="true" class="input" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`8eaadab8-a8c2-4c8d-8119-e374ca0180cf`)">
        </form>
        <hr><STList>
            <STListItem v-for="tag in $searchResult" :key="tag.id" :selectable="true" @click="toggleSelect(tag)">
                <template #left>
                    <Checkbox :model-value="isSelected(tag)" @click.stop.prevent="toggleSelect(tag)" />
                </template>
                <div>
                    <h2 class="style-title-list">
                        {{ tag.name }}
                    </h2>
                </div>
            </STListItem>
        </STList>
        <p v-if="!$searchResult.length" class="style-description-large">
            {{ $t('6944b7fa-f1c3-42ed-bd86-f43940baa745') }}
        </p>

        <TransitionFade>
            <div v-if="$selectedOutsideSearch.length" class="container">
                <hr><h2>{{ $t('8ca17e18-aaa5-46d4-8c2b-d57bf805f7d3') }}</h2>
                <STList :draggable="false">
                    <STListItem v-for="tag in $selectedOutsideSearch" :key="tag.id" :selectable="true" @click="toggleSelect(tag)">
                        <template #left>
                            <Checkbox :model-value="isSelected(tag)" @click.stop.prevent="toggleSelect(tag)" />
                        </template>
                        <div>
                            <h2 class="style-title-list">
                                {{ tag.name }}
                            </h2>
                        </div>
                    </STListItem>
                </STList>
            </div>
        </TransitionFade>
    </SaveView>
</template>

<script setup lang="ts">
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, TransitionFade, usePlatform } from '@stamhoofd/components';
import { OrganizationTag } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        allTags?: OrganizationTag[];
        tagIds?: string[];
        filter?: (tag: OrganizationTag) => boolean;
        onAdd: (
            allTags: OrganizationTag[],
            addedTags: OrganizationTag[],
            deletedTags: OrganizationTag[]
        ) => void;
    }>(),
    {
        allTags: undefined,
        tagIds: () => [],
        filter: undefined,
    },
);

const platform = usePlatform();

const title = $t(`4d08ffe7-8296-46e8-9372-e21cedcd73ff`);
const $saveText = computed(() => {
    if (!props.tagIds.length) return $t(`aaf91fd2-250b-4f2e-88a1-21af5747c760`);
    return $t(`30ea6c91-c638-45f7-9042-13247195743d`);
});

const $hasChanges = computed(() => {
    if (!props.tagIds.length) {
        return $selectedTags.value.size > 0;
    }

    const isDelete = props.tagIds.some(id => !$selectedTags.value.has(id));
    return isDelete || $selectedTags.value.size > props.tagIds.length;
});

const $searchString = ref('');
const pop = usePop();

const sourceTags = props.allTags ?? platform.value.config.tags;
const tags = props.filter ? sourceTags.filter(props.filter) : sourceTags;

const initialSelection = props.tagIds.reduce((result, tagId) => {
    const tag = tags.find(tag => tag.id === tagId);
    if (tag) {
        result.push(tag);
    }
    return result;
}, [] as OrganizationTag[]);

const $selectedTags = ref(new Map<string, OrganizationTag>(initialSelection.map(tag => [tag.id, tag])));
const $selectedOutsideSearch = computed(() => Array.from($selectedTags.value.values()).filter(tag => !$searchResult.value.includes(tag)));
const $searchResult = computed(() => {
    const searchString = $searchString.value.trim().toLowerCase();
    if (!searchString) return tags;
    return tags.filter(tag => tag.name.toLowerCase().includes(searchString));
});

function isSelected(tag: OrganizationTag): boolean {
    return $selectedTags.value.has(tag.id);
}

function toggleSelect(tag: OrganizationTag) {
    select(!isSelected(tag), tag);
}

function select(value: boolean, tag: OrganizationTag) {
    if (value) {
        $selectedTags.value.set(tag.id, tag);
    }
    else {
        if (isSelected(tag)) {
            $selectedTags.value.delete(tag.id);
        }
    }
}

function getSelectionAsArray() {
    return Array.from($selectedTags.value.values());
}

async function save() {
    const allTags = getSelectionAsArray();
    const deletedTags = initialSelection.filter(tag => !allTags.includes(tag));

    if (deletedTags.length) {
        let confirmText = $t(`d3e9fd5b-9abc-4473-97e7-0c7734c2f14d`);

        if (allTags.length) {
            const deleteCount = deletedTags.length;
            const selectionCount = allTags.length;
            const deletedTagsString = deletedTags.map(t => t.name).join(', ');
            const selectionText = selectionCount === 1 ? $t(`7b73af21-99ab-4b47-8e50-e3930ebc3058`) : `Er zijn ${selectionCount} tags geselecteerd.`;

            if (deletedTagsString.length > 100) {
                confirmText = `${selectionText} Ben je zeker dat je ${deleteCount} tags wilt verwijderen?`;
            }
            else {
                confirmText = `${selectionText} Ben je zeker dat je de volgende tag(s) wilt verwijderen: ${deletedTagsString}`;
            }
        }

        const isConfirm = await CenteredMessage.confirm(confirmText, $t(`1ae8cbc7-9ef5-43db-b9a3-0117dfa43be1`));
        if (!isConfirm) return false;
    }

    const addedTags = allTags.filter(tag => !initialSelection.includes(tag));
    props.onAdd(allTags, addedTags, deletedTags);
    await pop();
}
</script>
