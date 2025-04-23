<template>
    <div class="st-view document-view">
        <STNavigationBar :title="$t(`9464cf2b-10a9-4690-8ab6-2e3d2f3e9b9d`)">
            <template #right>
                <button v-if="hasPrevious || hasNext" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('09874d23-8023-402b-b464-8fa59460a509')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('516c5273-3f27-41e2-9b2b-0ffb94501ca1')" @click="goForward" />
                <button v-long-press="(e: MouseEvent) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                {{ $t('f4b5c997-f9ed-4ba9-aabd-ac1d5fa37dfb') }}
            </h1>

            <p v-if="unlinkedAnswers.length" class="info-box">
                {{ $t('719f31f6-cae0-41b0-97e6-ab8f5ff01d19', { unlinkedAnswersText }) }}
                <button class="button text" type="button" @click="resetDocument">
                    {{ $t('4efa0c2b-f5af-48fc-9fb3-37ccbdf1ca24') }}
                </button>
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.data.description }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('bb5c03d2-d684-40b6-9aa9-6f0877f41441') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ document.id }} ({{ document.number || 'Zonder nummer' }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(document.createdAt)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 :class="'style-definition-label '+statusColor">
                        {{ $t('e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                    </p>
                </STListItem>
            </STList>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="document" />
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
