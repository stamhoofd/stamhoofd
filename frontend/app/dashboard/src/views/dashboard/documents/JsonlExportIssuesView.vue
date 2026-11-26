<template>
    <SaveView
        :title="$t('Controle')"
        :loading="downloading"
        :disabled="result.isBlocked"
        :save-text="saveText"
        save-icon="download"
        :add-extra-cancel="true"
        @save="downloadWithoutIssues"
    >
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>

        <p v-if="checking" class="style-description">
            <Spinner />
        </p>

        <template v-if="result.isBlocked">
            <p v-for="(issue, index) of blockingIssues" :key="index" class="error-box">
                {{ issue.message }}
            </p>
        </template>

        <template v-else>
            <template v-if="documents.length">
                <hr>
                <h2>{{ rejectedTitle }}</h2>
                <p class="style-description">
                    {{ $t('Belcotax zou deze weigeren. Pas ze aan of download zonder deze attesten.') }}
                </p>

                <STList>
                    <STListItem v-for="document of documents" :key="document.id" :selectable="true" @click="openDocument(document.id)">
                        <template #left>
                            <span class="icon warning gray" />
                        </template>
                        <h3 class="style-title-list">
                            {{ document.description || document.id }}
                        </h3>
                        <p v-for="(message, index) of document.messages" :key="index" class="style-description-small">
                            {{ message }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="incompleteDocuments.length">
                <hr>
                <h2>{{ incompleteTitle }}</h2>
                <p class="style-description">
                    {{ $t('Enkel gepubliceerde attesten staan in het bestand. Vul de ontbrekende gegevens aan of download zonder deze attesten.') }}
                </p>

                <STList>
                    <STListItem v-for="document of incompleteDocuments" :key="document.id" :selectable="true" @click="openDocument(document.id)">
                        <template #left>
                            <span class="icon warning gray" />
                        </template>
                        <h3 class="style-title-list">
                            {{ document.description || document.id }}
                        </h3>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useDocumentsObjectFetcher } from '@stamhoofd/components/fetchers/useDocumentsObjectFetcher.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { JsonlExportResult, DocumentTemplatePrivate } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { computed, onActivated, ref } from 'vue';

const props = defineProps<{
    initialResult: JsonlExportResult;
    template: DocumentTemplatePrivate;
    /**
     * Builds the file again, so the lists and the download match the documents as they are now
     */
    check: () => Promise<JsonlExportResult | null>;
    /**
     * Downloads the given file and returns its name
     */
    download: (result: JsonlExportResult) => Promise<string>;
}>();

const show = useShow();
const fetcher = useDocumentsObjectFetcher();
const downloading = ref(false);
const checking = ref(false);
const result = ref<JsonlExportResult>(props.initialResult);
let openedDocument = false;

const blockingIssues = computed(() => result.value.issues.filter(issue => issue.documentId === null));
const incompleteDocuments = computed(() => result.value.incompleteDocuments);
const total = computed(() => documents.value.length + incompleteDocuments.value.length);

const rejectedTitle = computed(() => documents.value.length === 1
    ? $t('1 attest kan niet mee')
    : $t('{count} attesten kunnen niet mee', { count: documents.value.length.toString() }));
const incompleteTitle = computed(() => incompleteDocuments.value.length === 1
    ? $t('1 onvolledig attest gaat niet mee')
    : $t('{count} onvolledige attesten gaan niet mee', { count: incompleteDocuments.value.length.toString() }));

const title = computed(() => {
    if (result.value.isBlocked) {
        return $t('Het bestand kan niet gemaakt worden');
    }
    return total.value === 1
        ? $t('1 attest gaat niet mee')
        : $t('{count} attesten gaan niet mee', { count: total.value.toString() });
});

const description = computed(() => {
    if (result.value.isBlocked) {
        return $t('Belcotax zou het volledige bestand weigeren. Los dit eerst op.');
    }
    return result.value.documentCount === 1
        ? $t('1 ander attest staat wel in het bestand.')
        : $t('De andere {count} attesten staan wel in het bestand.', { count: result.value.documentCount.toString() });
});

const saveText = computed(() => $t('Downloaden zonder deze {count}', { count: total.value.toString() }));

const documents = computed(() => {
    const map = new Map<string, { id: string; description: string | null; messages: string[] }>();
    for (const issue of result.value.issues) {
        if (issue.documentId === null) {
            continue;
        }
        const existing = map.get(issue.documentId) ?? { id: issue.documentId, description: issue.documentDescription, messages: [] };
        existing.messages.push(issue.message);
        map.set(issue.documentId, existing);
    }
    return [...map.values()];
});

// A document can be corrected from this view, so the file that is downloaded has to match what is listed here
onActivated(() => {
    if (!openedDocument) {
        return;
    }
    openedDocument = false;
    recheck().catch(console.error);
});

async function recheck() {
    if (checking.value) {
        return;
    }
    checking.value = true;
    try {
        const updated = await props.check();
        if (updated) {
            result.value = updated;
        }
    } finally {
        checking.value = false;
    }
}

async function openDocument(id: string) {
    try {
        const { results } = await fetcher.fetch(new LimitedFilteredRequest({ filter: { id }, limit: 1 }));
        const document = results[0];
        if (!document) {
            return;
        }
        openedDocument = true;
        await show(new ComponentWithProperties((await import('./DocumentView.vue')).default, {
            document,
            template: props.template,
        }));
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function downloadWithoutIssues() {
    if (downloading.value || checking.value) {
        return;
    }
    downloading.value = true;
    try {
        const fileName = await props.download(result.value);
        await show({
            components: [
                AsyncComponent(() => import('./JsonlDownloadedView.vue'), { fileName, year: props.template.year }),
            ],
            replace: 1,
            animated: true,
            force: true,
        });
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        downloading.value = false;
    }
}
</script>
