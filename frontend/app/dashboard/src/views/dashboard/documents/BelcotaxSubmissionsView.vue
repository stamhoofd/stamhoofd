<template>
    <div class="st-view" data-testid="belcotax-submissions-view">
        <STNavigationBar :title="$t('Zendingen')" />

        <main>
            <h1>{{ $t('Zendingen naar Belcotax') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <Spinner v-if="loading" />

            <p v-else-if="submissions.length === 0" class="info-box">
                {{ $t('Je stuurde deze attesten nog niet door naar Belcotax.') }}
            </p>

            <STList v-else>
                <STListItem v-for="submission of submissions" :key="submission.id" :selectable="true" data-testid="belcotax-submission" @click="open(submission)">
                    <h3 class="style-title-list">
                        {{ $t('Zending van {date}', { date: Formatter.dateTime(submission.createdAt) }) }}
                    </h3>
                    <p class="style-description-small">
                        {{ submission.documentCount === 1 ? $t('1 attest') : $t('{count} attesten', { count: submission.documentCount.toString() }) }} · {{ $t('door {name}', { name: submission.submittedBy }) }}
                    </p>
                    <template #right>
                        <span class="style-tag" :class="BelcotaxSubmissionStatusHelper.getColor(submission.status)">{{ BelcotaxSubmissionStatusHelper.getName(submission.status) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@common/encoding';
import { ArrayDecoder } from '@common/encoding';
import { useShow } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import type { DocumentTemplatePrivate } from '@stamhoofd/structures';
import { BelcotaxSubmission, BelcotaxSubmissionStatusHelper } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { Formatter } from '@stamhoofd/utility';
import { onMounted, ref } from 'vue';

const props = defineProps<{
    template: DocumentTemplatePrivate;
}>();

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const show = useShow();

const submissions = ref<BelcotaxSubmission[]>([]);
const loading = ref(true);

async function load() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/document-templates/' + encodeURIComponent(props.template.id) + '/belcotax/submissions',
            decoder: new ArrayDecoder(BelcotaxSubmission as Decoder<BelcotaxSubmission>),
            shouldRetry: false,
            owner,
        });
        submissions.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}

async function open(submission: BelcotaxSubmission) {
    await show(AsyncComponent(() => import('./BelcotaxSubmissionView.vue'), {
        submission,
        template: props.template,
    }));
}

onMounted(() => {
    load().catch(console.error);
});
</script>
