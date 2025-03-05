<template>
    <div class="st-view document-view">
        <STNavigationBar :title="$t(`Document`)">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorig document'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack"/>
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende document'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward"/>
                <button v-long-press="(e: MouseEvent) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu"/>
            </template>
        </STNavigationBar>
        <main>
            <h1>
                {{ $t('754c441a-b848-4d84-ae32-fe5c7cc575a7') }}
            </h1>

            <p v-if="unlinkedAnswers.length" class="info-box">
                {{ $t('719f31f6-cae0-41b0-97e6-ab8f5ff01d19', { unlinkedAnswersText }) }}
                <button class="button text" type="button" @click="resetDocument">
                    {{ $t('b09e88a7-a60a-43ac-8368-04fcb56ed0e7') }}
                </button>
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon"/>
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr></div>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('f72f5546-ed6c-4c93-9b0d-9718f0cc9626') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.description }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('1fbc7bea-24e0-4ef5-a0bb-6f9e1e4ecaf5') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.id }} ({{ document.number || 'Zonder nummer' }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('25981b4f-4483-47f9-8c3a-ac5e7bdc1a69') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(document.createdAt)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 :class="'style-definition-label '+statusColor">
                        {{ $t('38b75e19-10cb-4641-88a8-f4e2e9be7576') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                    </p>
                </STListItem>
            </STList>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="document"/>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar, TableActionsContextMenu, TableActionSelection, useBackForward, useContext, useNavigationActions, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { Document, DocumentStatusHelper, DocumentTemplatePrivate, RecordCategory, RecordWarning } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed } from 'vue';
import { DocumentActionBuilder } from './DocumentActionBuilder';

const props = withDefaults(defineProps<{
    document: Document;
    template: DocumentTemplatePrivate;
    getNext?: ((document: Document) => Document) | null;
    getPrevious?: ((document: Document) => Document) | null;
    addDocument?: ((document: Document) => void) | null;
}>(), {
    getNext: null,
    getPrevious: null,
    addDocument: null,
});

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('document', props);
const context = useContext();
const navigationActions = useNavigationActions();
const { present } = navigationActions;

const usedAnswers = computed(() => {
    return [...props.document.getRecordAnswers().values()].filter((a) => {
        return !!recordCategories.value.find((c) => {
            return !!c.getAllRecords().find((r) => {
                return r.id === a.settings.id;
            });
        });
    });
});

const warnings = computed(() => {
    const warnings: RecordWarning[] = [];

    for (const answer of usedAnswers.value) {
        warnings.push(...answer.getWarnings());
    }

    return warnings;
});

const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort));

const hasWarnings = computed(() => warnings.value.length > 0);

const unlinkedAnswers = computed(() => usedAnswers.value.filter(a => !!a.reviewedAt));
const unlinkedAnswersText = computed(() => Formatter.joinLast(unlinkedAnswers.value.map(a => a.settings.name), ', ', ' en '));

const actionBuilder = computed(() => {
    return new DocumentActionBuilder({
        $context: context.value,
        template: props.template,
        navigationActions,
        addDocument: props.addDocument ?? undefined,
    });
});

const statusName = computed(() => props.document ? DocumentStatusHelper.getName(props.document.status) : '');
const statusColor = computed(() => props.document ? DocumentStatusHelper.getColor(props.document.status) : '');

function showContextMenu(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const bounds = el.getBoundingClientRect();

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.left,
        y: bounds.bottom,
        xPlacement: 'right',
        yPlacement: 'bottom',
        actions: actionBuilder.value.getActions(),
        // selection: todo
        selection: {
            filter: {}, // todo
            fetcher: {}, // todo
            markedRows: new Map([[props.document.id, props.document]]),
            markedRowsAreSelected: true,
        } as TableActionSelection<Document>,
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

function resetDocument() {
    actionBuilder.value.resetDocuments([props.document]).catch(console.error);
}

const recordCategories = computed(() => {
    return RecordCategory.flattenCategories(
        [...props.template.privateSettings.templateDefinition.documentFieldCategories, ...props.template.privateSettings.templateDefinition.groupFieldCategories],
        props.document,
    );
});
</script>
