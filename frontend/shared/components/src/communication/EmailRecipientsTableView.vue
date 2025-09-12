<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <p v-if="props.filterType === 'complaints'" class="style-description-block">
            <I18nComponent :t="$t('8b0c0037-883c-4b8d-aeb6-cda8b3f40b52')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'hard-bounces'" class="style-description-block">
            <I18nComponent :t="$t('f6bfb25a-c045-46bc-a6d2-ea475f3bb600')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'soft-bounces'" class="style-description-block">
            <I18nComponent :t="$t('ff205726-520f-48f1-a631-a03f735eed68')">
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
import { isSoftEmailRecipientError } from '@stamhoofd/structures';

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
        return $t('516a8610-8374-4e6d-bf68-1a45b67b0124');
    }
    if (props.filterType === 'hard-bounces') {
        return $t('800c4591-92bb-45f8-9040-5fb1d05dd2b4');
    }
    if (props.filterType === 'soft-bounces') {
        return $t('cda7f8f5-dfe5-4ac4-a69c-35301da62120');
    }
    if (props.filterType === 'failed') {
        return $t('2df0c254-5bfd-4cda-9da4-90352ee2a75f');
    }

    if (props.email) {
        return $t('d9b3ba62-99cb-4851-9553-87b5e5f34106', { emailSubject: props.email.replacedSubject });
    }
    return $t('13191887-8762-4b8b-a656-12cf86594579');
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
            duplicateOfRecipientId: null,
            email: {
                $neq: null,
            },
        };
    }

    return {
        duplicateOfRecipientId: null,
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
        name: $t('237d0720-13f0-4029-8bf2-4de7e0a9a358'),
        getValue: e => e.email || '',
        minimumWidth: 200,
        recommendedWidth: 300,
        index: 0,
    }),

    new Column<ObjectType, string | null>({
        id: 'name',
        name: $t('45ebf52f-e5ba-4995-a3d8-e300f5a9e707'),
        getValue: e => e.name || '',
        minimumWidth: 150,
        recommendedWidth: 200,
        index: 1,
    }),

    new Column<ObjectType, EmailRecipient>({
        id: 'sentAt',
        name: $t('b57f80e3-ac03-4238-a489-f92cdceb1086'),
        getValue: e => e,
        format: (email) => {
            if (email.sentAt) {
                return $t('9f8924bc-bd3e-4379-ac34-92a57b577c7a', { time: Formatter.time(email.sentAt) });
            }

            if (email.failError) {
                if (email.failError.hasCode('email_skipped_hard_bounce')) {
                    return $t('c1470365-cafb-4d5d-94c2-bcead6aa77e7');
                }
                if (email.failError.hasCode('email_skipped_spam')) {
                    return $t('536208f5-b4db-40e1-9198-2224e2eb9883');
                }
                if (email.failError.hasCode('email_skipped_unsubscribed')) {
                    return $t('8050a561-db7c-4c23-9930-c8474fd37586');
                }
                return email.failError.human;
            }

            return $t('520e00ad-230c-4004-86bc-20694e56c2af');
        },
        getStyle: (email) => {
            if (email.sentAt) {
                return 'success';
            }

            if (email.failError && isSoftEmailRecipientError(email.failError)) {
                return 'warn';
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
        name: $t('1eafb06a-5385-42fd-8f1a-2bbaaf735e53'),
        description: $t('409621cb-c4e4-4d3e-bfcc-a1f607e2c907'),
        getValue: e => e,
        format: (email) => {
            if (email.spamComplaintError) {
                return $t('c096947a-d82c-4478-95b3-b3411da84361');
            }

            if (email.hardBounceError) {
                return $t('32f0884a-f2fc-4563-8403-b67c482823d3');
            }

            if (email.softBounceError) {
                return $t('793bf19f-ba89-4a0f-9999-06f554194db6');
            }

            return $t('3ef9e622-426f-4913-89a0-0ce08f4542d4');
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
