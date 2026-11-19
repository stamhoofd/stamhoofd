<template>
    <div class="st-view" data-testid="belcotax-submission-view">
        <STNavigationBar :title="$t('Zending')" />

        <main>
            <h1>{{ $t('Zending van {date}', { date: Formatter.dateTime(submission.createdAt) }) }}</h1>
            <p class="style-description">
                {{ summary }}
            </p>

            <STList>
                <STListItem v-for="step of steps" :key="step.name" data-testid="belcotax-submission-step" :data-state="step.state">
                    <template #left>
                        <span v-if="step.state === 'done'" class="icon success green" />
                        <span v-else-if="step.state === 'failed'" class="icon canceled red" />
                        <span v-else-if="step.state === 'unknown'" class="icon warning yellow" />
                        <span v-else class="icon clock gray" />
                    </template>
                    <h3 class="style-title-list">
                        {{ step.name }}
                    </h3>
                </STListItem>
            </STList>

            <p v-if="submission.errorMessage" class="error-box">
                {{ submission.errorMessage }}
            </p>

            <template v-if="submission.issues.length">
                <hr>
                <h2 v-if="submission.issues.length === 1">
                    {{ $t('1 fout van Belcotax') }}
                </h2>
                <h2 v-else>
                    {{ $t('{count} fouten van Belcotax', { count: submission.issues.length.toString() }) }}
                </h2>

                <STList>
                    <STListItem v-for="document of documents" :key="document.id" :selectable="true" data-testid="belcotax-submission-issue" @click="openDocument(document.id)">
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
                    <STListItem v-for="(issue, index) of generalIssues" :key="'general-' + index" data-testid="belcotax-submission-issue">
                        <h3 class="style-title-list">
                            {{ issue.key ?? $t('Volledige zending') }}
                        </h3>
                        <p class="style-description-small">
                            {{ issue.message }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <p v-if="submission.status === BelcotaxSubmissionStatus.Rejected" class="style-description-small">
                {{ $t('Pas de attesten aan en kies opnieuw Doorsturen. Wat al aanvaard is, gaat niet opnieuw mee.') }}
            </p>
            <p v-else-if="submission.isOpen" class="style-description-small">
                {{ $t('Je mag dit venster sluiten; het resultaat komt ook per e-mail.') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@common/encoding';
import { ComponentWithProperties, useShow } from '@browser/navigation';
import { useDocumentsObjectFetcher } from '@stamhoofd/components/fetchers/useDocumentsObjectFetcher.ts';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { DocumentTemplatePrivate } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { BelcotaxSubmission, BelcotaxSubmissionStatus, BelcotaxSubmissionStatusHelper } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

type StepState = 'done' | 'failed' | 'unknown' | 'waiting';

const props = defineProps<{
    submission: BelcotaxSubmission;
    template: DocumentTemplatePrivate;
}>();

const context = useContext();
const owner = useRequestOwner();
const show = useShow();
const fetcher = useDocumentsObjectFetcher();

const submission = ref(props.submission);
let timer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

const summary = computed(() => {
    const s = submission.value;
    const count = s.documentCount === 1 ? $t('1 attest') : $t('{count} attesten', { count: s.documentCount.toString() });
    const parts = [count, $t('door {name}', { name: s.submittedBy })];
    if (s.bulkId) {
        parts.push($t('zendingsnummer {id}', { id: s.bulkId }));
    }
    return parts.join(' · ');
});

const steps = computed<{ name: string; state: StepState }[]>(() => {
    const status = submission.value.status;
    const received = !!submission.value.bulkId;

    const sent: StepState = status === BelcotaxSubmissionStatus.Sending ? 'waiting' : (status === BelcotaxSubmissionStatus.Failed ? 'failed' : 'done');
    const format: StepState = received ? 'done' : (status === BelcotaxSubmissionStatus.Rejected ? 'failed' : 'waiting');

    let result: StepState = 'waiting';
    if (status === BelcotaxSubmissionStatus.Accepted) {
        result = 'done';
    } else if (status === BelcotaxSubmissionStatus.Rejected) {
        result = 'failed';
    } else if (status === BelcotaxSubmissionStatus.Unknown) {
        result = 'unknown';
    }

    return [
        { name: $t('Verstuurd'), state: sent },
        { name: $t('Formaat in orde'), state: format },
        { name: received || status === BelcotaxSubmissionStatus.Accepted ? BelcotaxSubmissionStatusHelper.getName(status) : $t('Resultaat'), state: result },
    ];
});

const documents = computed(() => {
    const map = new Map<string, { id: string; description: string | null; messages: string[] }>();
    for (const issue of submission.value.issues) {
        if (issue.documentId === null) {
            continue;
        }
        const existing = map.get(issue.documentId) ?? { id: issue.documentId, description: issue.documentDescription, messages: [] };
        existing.messages.push(issue.message);
        map.set(issue.documentId, existing);
    }
    return [...map.values()];
});

const generalIssues = computed(() => submission.value.issues.filter(issue => issue.documentId === null));

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/belcotax/submissions/' + encodeURIComponent(submission.value.id),
            decoder: BelcotaxSubmission as Decoder<BelcotaxSubmission>,
            shouldRetry: false,
            owner,
        });
        submission.value = response.data;
    } catch (e) {
        console.error(e);
    }
}

/**
 * The server polls Belcotax; this only shows its result as soon as it arrives
 */
function schedule() {
    if (stopped || !submission.value.isOpen) {
        return;
    }
    timer = setTimeout(() => {
        reload().catch(console.error).finally(schedule);
    }, 3_000);
}

async function openDocument(id: string) {
    try {
        const { results } = await fetcher.fetch(new LimitedFilteredRequest({ filter: { id }, limit: 1 }));
        const document = results[0];
        if (!document) {
            return;
        }
        await show(new ComponentWithProperties((await import('./DocumentView.vue')).default, {
            document,
            template: props.template,
        }));
    } catch (e) {
        Toast.fromError(e).show();
    }
}

onMounted(() => {
    schedule();
});

onBeforeUnmount(() => {
    stopped = true;
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
});
</script>
