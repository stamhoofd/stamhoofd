<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <p v-if="props.filterType === 'complaints'" class="style-description-block">
            <I18nComponent :t="$t('Hieronder zie je alle ontvangers die een spammelding hebben ingediend voor een e-mail die je hebt verstuurd. Dit kan gebeuren als iemand de e-mail als spam markeert in zijn of haar e-mailprogramma. <button>Meer info</button>')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'hard-bounces'" class="style-description-block">
            <I18nComponent :t="$t('Bij een hard bounce komt een e-mail na het versturen terug omwille van een permanente reden, bv. als het e-mailadres niet bestaat. <button>Meer info</button>')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'soft-bounces'" class="style-description-block">
            <I18nComponent :t="$t('Bij een soft bounce komt een e-mail na het versturen terug omwille van een tijdelijke reden, bv. een volle inbox. <button>Meer info</button>')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <template #empty>
            {{ $t('4fa242b7-c05d-44d4-ada5-fb60e91af818') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column, ComponentExposed, ModernTableView, TableAction, useEmailRecipientsFilterBuilders, useTableObjectFetcher } from '@stamhoofd/components';
import { EmailPreview, EmailRecipient, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import { useEmailRecipientsObjectFetcher } from '../fetchers/useEmailRecipientsObjectFetcher';
import EmailRecipientView from './EmailRecipientView.vue';
import { I18nComponent } from '@stamhoofd/frontend-i18n';

type ObjectType = EmailRecipient;

const props = withDefaults(
    defineProps<{
        filterType?: null | 'complaints' | 'hard-bounces' | 'soft-bounces' | 'failed';
        email?: EmailPreview | null;
        filter?: StamhoofdFilter | null;
    }>(),
    {
        email: null,
        filter: null,
        filterType: null,
    },
);

const title = computed(() => {
    if (props.filterType === 'complaints') {
        return $t('Spammeldingen');
    }
    if (props.filterType === 'hard-bounces') {
        return $t('Hard bounces');
    }
    if (props.filterType === 'soft-bounces') {
        return $t('Soft bounces');
    }
    if (props.filterType === 'failed') {
        return $t('Mislukte berichten');
    }

    if (props.email) {
        return $t('Ontvangers van ‘{emailSubject}’', { emailSubject: props.email.replacedSubject });
    }
    return $t('Alle ontvangers');
});

const estimatedRows = computed(() => {
    if (props.email) {
        return props.email.emailRecipientsCount ?? 0;
    }
    return 30;
});
const getFilterBuilders = useEmailRecipientsFilterBuilders();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'event-notifications';
});
const filterBuilders = computed(() => getFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.email) {
        return {
            emailId: props.email.id,
            email: {
                $neq: null,
            },
        };
    }

    return {
        email: {
            $neq: null,
        },
    };
}

const defaultFilter = props.filter; ;

const objectFetcher = useEmailRecipientsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string | null>({
        id: 'email',
        name: $t('E-mailadres'),
        getValue: e => e.email || '',
        minimumWidth: 200,
        recommendedWidth: 300,
        index: 0,
    }),

    new Column<ObjectType, string | null>({
        id: 'name',
        name: $t('Naam'),
        getValue: e => e.name || '',
        minimumWidth: 150,
        recommendedWidth: 200,
        index: 1,
    }),

    new Column<ObjectType, EmailRecipient>({
        id: 'sentAt',
        name: $t('Verzonden op'),
        getValue: e => e,
        format: (email) => {
            if (email.sentAt) {
                return $t('Verzonden om {time}', { time: Formatter.time(email.sentAt) });
            }

            if (email.failError) {
                if (email.failError.hasCode('email_skipped_hard_bounce')) {
                    return $t('Eerdere hard bounce');
                }
                if (email.failError.hasCode('email_skipped_spam')) {
                    return $t('Eerdere spammelding');
                }
                if (email.failError.hasCode('email_skipped_unsubscribed')) {
                    return $t('Afgemeld voor deze e-mails');
                }
                return email.failError.human;
            }

            return $t('In wachtrij');
        },
        getStyle: (email) => {
            if (email.sentAt) {
                return 'success';
            }

            if (email.failError) {
                return 'error';
            }

            return 'gray';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        index: 2,
    }),

    new Column<ObjectType, EmailRecipient>({
        id: 'notifications',
        name: $t('Meldingen'),
        description: $t('Na het versturen van een e-mail is het mogelijk dat we een bericht terug krijgen dat de e-mail niet kon worden bezorgd of als spam werd gemarkeerd. Dat verschijnt hier.'),
        getValue: e => e,
        format: (email) => {
            if (email.spamComplaintError) {
                return $t('Spam');
            }

            if (email.hardBounceError) {
                return $t('E-mail kon permanent niet worden afgeleverd');
            }

            if (email.softBounceError) {
                return $t('E-mail kon niet worden afgeleverd');
            }

            return $t('Geen');
        },
        getStyle: (email) => {
            if (email.spamComplaintError || email.hardBounceError) {
                return 'error';
            }

            if (email.softBounceError) {
                return 'warning';
            }

            return 'success';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        index: 3,
        allowSorting: false,
    }),
];

const Route = {
    Component: EmailRecipientView,
    objectKey: 'recipient',
    getProperties: (object: ObjectType) => {
        return {
            email: props.email ?? undefined,
            recipient: object,
        };
    },
};

const actions: TableAction<ObjectType>[] = [];
</script>
