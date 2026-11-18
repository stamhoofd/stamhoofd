<template>
    <div class="st-view" data-testid="belcotax-submit-view">
        <STNavigationBar :title="$t('Doorsturen naar Belcotax')" />

        <main>
            <h1>{{ $t('Doorsturen naar Belcotax') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <Spinner v-if="!preview" />

            <template v-else>
                <template v-if="preview.check.isBlocked">
                    <p>{{ $t('Belcotax zou het volledige bestand weigeren. Los dit eerst op.') }}</p>
                    <p v-for="(issue, index) of blockingIssues" :key="index" class="error-box">
                        {{ issue.message }}
                    </p>
                </template>

                <template v-else>
                    <p>{{ $t('Enkel wat Belcotax nog niet aanvaardde, gaat mee. Er vertrekt niets tot je op Doorsturen klikt.') }}</p>

                    <STList>
                        <STListItem>
                            <h3 class="style-title-list">
                                {{ $t('Nieuwe attesten') }}
                            </h3>
                            <template #right>
                                <span class="style-description" data-testid="belcotax-new-count">{{ preview.newCount }}</span>
                            </template>
                        </STListItem>
                        <STListItem>
                            <h3 class="style-title-list">
                                {{ $t('Gewijzigd sinds aanvaard') }}
                            </h3>
                            <template #right>
                                <span class="style-description" data-testid="belcotax-changed-count">{{ preview.changedCount }}</span>
                            </template>
                        </STListItem>
                        <STListItem>
                            <h3 class="style-title-list">
                                {{ $t('Verwijderen bij Belcotax') }}
                            </h3>
                            <template #right>
                                <span class="style-description" data-testid="belcotax-deleted-count">{{ preview.deletedCount }}</span>
                            </template>
                        </STListItem>
                    </STList>

                    <p v-if="preview.unchangedCount" class="style-description-small">
                        {{ $t('Belcotax aanvaardde {count} attesten al. Die gaan niet opnieuw mee.', { count: preview.unchangedCount.toString() }) }}
                    </p>

                    <p v-if="heldBackCount" class="warning-box selectable with-button" data-testid="belcotax-held-back" @click="showCheck">
                        {{ heldBackCount === 1 ? $t('1 attest kan niet mee. Zelfde controle als bij downloaden.') : $t('{count} attesten kunnen niet mee. Zelfde controle als bij downloaden.', { count: heldBackCount.toString() }) }}

                        <button class="button text" type="button">
                            {{ $t('Bekijk') }}
                        </button>
                    </p>

                    <p v-if="preview.openSubmission" class="info-box">
                        {{ $t('Belcotax controleert nog de zending van {date}. Wacht op het resultaat voor je opnieuw doorstuurt.', { date: Formatter.dateTime(preview.openSubmission.createdAt) }) }}
                    </p>
                    <p v-else-if="!preview.isConnected && !preview.companyId" class="error-box">
                        {{ $t('Ondernemingsnummer {kbo} staat niet bij de entiteiten in de instellingen. Voeg het daar toe om met Belcotax te verbinden.', { kbo: formatCompanyNumber(preview.companyNumber) }) }}
                    </p>
                    <p v-else-if="!preview.isConnected" class="info-box">
                        {{ $t('Onderneming {kbo} is nog niet verbonden met Belcotax. Bij Doorsturen meld je eerst aan bij de FOD Financiën als wettelijk vertegenwoordiger, daarna kom je hier terug.', { kbo: formatCompanyNumber(preview.companyNumber) }) }}
                    </p>
                </template>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="dismiss()">
                    {{ $t('Annuleren') }}
                </button>
                <LoadingButton :loading="submitting">
                    <button class="button primary" type="button" data-testid="belcotax-submit" :disabled="!canSubmit" @click="submit">
                        <span class="icon upload" />
                        <span>{{ $t('Doorsturen') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@common/encoding';
import { isSimpleError, isSimpleErrors } from '@common/errors';
import { useDismiss, useShow } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import type { DocumentTemplatePrivate } from '@stamhoofd/structures';
import { BelcotaxSubmission, BelcotaxSubmitPreview } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import { useBelcotaxConnect } from '../settings/useBelcotaxConnect';

const props = defineProps<{
    template: DocumentTemplatePrivate;
    /**
     * The template page, where FOD Financiën returns to after connecting
     */
    returnUrl: string;
}>();

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const dismiss = useDismiss();
const show = useShow();
const belcotaxConnect = useBelcotaxConnect();

const preview = ref<BelcotaxSubmitPreview | null>(null);
const submitting = ref(false);

const blockingIssues = computed(() => preview.value?.check.issues.filter(issue => issue.documentId === null) ?? []);
const heldBackCount = computed(() => {
    const check = preview.value?.check;
    if (!check) {
        return 0;
    }
    return new Set(check.issues.map(issue => issue.documentId).filter(id => id !== null)).size + check.incompleteDocuments.length;
});
const canSubmit = computed(() => {
    const p = preview.value;
    if (!p || p.check.isBlocked || p.openSubmission || p.sendCount === 0) {
        return false;
    }
    return p.isConnected || p.companyId !== null;
});

function formatCompanyNumber(companyNumber: string) {
    return companyNumber.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1.$2.$3');
}

async function load() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/document-templates/' + encodeURIComponent(props.template.id) + '/belcotax/preview',
            decoder: BelcotaxSubmitPreview as Decoder<BelcotaxSubmitPreview>,
            shouldRetry: false,
            timeout: 5 * 60 * 1000,
            owner,
        });
        preview.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function showCheck() {
    if (!preview.value) {
        return;
    }
    await show(AsyncComponent(() => import('./JsonlExportIssuesView.vue'), {
        initialResult: preview.value.check,
        template: props.template,
    }));
}

async function connect() {
    const companyId = preview.value?.companyId;
    if (!companyId) {
        return;
    }
    await belcotaxConnect.connect(companyId, new URL(props.returnUrl));
}

async function submit() {
    if (submitting.value || !preview.value) {
        return;
    }
    submitting.value = true;
    errors.errorBox = null;

    try {
        if (!preview.value.isConnected) {
            await connect();
            return;
        }

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/document-templates/' + encodeURIComponent(props.template.id) + '/belcotax/submit',
            decoder: BelcotaxSubmission as Decoder<BelcotaxSubmission>,
            shouldRetry: false,
            timeout: 5 * 60 * 1000,
            owner,
        });
        await show({
            components: [
                AsyncComponent(() => import('./BelcotaxSubmissionView.vue'), {
                    submission: response.data,
                    template: props.template,
                }),
            ],
            replace: 1,
            animated: true,
            force: true,
        });
    } catch (e) {
        if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('belcotax_connection_expired') && preview.value.companyId) {
            try {
                await connect();
                return;
            } catch (connectError) {
                errors.errorBox = new ErrorBox(connectError);
            }
        } else {
            errors.errorBox = new ErrorBox(e);
        }
        submitting.value = false;
    }
}

onMounted(() => {
    load().catch(console.error);
});
</script>
