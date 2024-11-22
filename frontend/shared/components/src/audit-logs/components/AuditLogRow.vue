<template>
    <STListItem class="right-stack">
        <template #left>
            <IconContainer :icon="log.icon">
                <template v-if="log.subIcon" #aside>
                    <ProgressIcon :icon="log.subIcon" />
                </template>
            </IconContainer>
        </template>

        <h3 class="style-title-list">
            <RenderTextComponent :text="log.renderableTitle" />
        </h3>
        <p class="style-description">
            {{ formatDateTime(log.createdAt, false, true) }}
        </p>
        <p v-if="log.user" class="style-description">
            Door {{ log.user.name }}
        </p>

        <p v-if="log.description" class="style-description-small pre-wrap" v-text="log.description" />

        <PatchListText v-if="log.patchList" :items="log.patchList" />
    </STListItem>
</template>

<script setup lang="ts">
import { AuditLog, AuditLogReplacement, AuditLogReplacementType, LimitedFilteredRequest } from '@stamhoofd/structures';
import IconContainer from '../../icons/IconContainer.vue';
import ProgressIcon from '../../icons/ProgressIcon.vue';
import PatchListText from './PatchListText.vue';
import { h } from 'vue';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { MemberSegmentedView } from '../../members';
import { useMembersObjectFetcher } from '../../fetchers';
import { Toast } from '../../overlays/Toast';
import { PromiseView } from '../../containers';

defineProps<{
    log: AuditLog;
}>();

const present = usePresent();

function renderAny(obj: unknown) {
    if (typeof obj === 'string') {
        return obj;
    }
    if (obj instanceof AuditLogReplacement) {
        if (obj.type === AuditLogReplacementType.Member && obj.id) {
            // Open member button
            return h('button', {
                class: 'style-subtle-link button simple',
                onClick: () => showMember(obj.id!),
                type: 'button',
            }, obj.value);
        }
        return obj.value;
    }
    return obj;
}

const RenderTextComponent = {
    props: {
        text: {
            type: Array,
            required: true,
        },
    },
    setup(props: { text: unknown[] }) {
        return () => props.text.map(part => renderAny(part));
    },
};
const memberFetcher = useMembersObjectFetcher();

async function showMember(memberId: string) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const members = await memberFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: memberId,
                    },
                    limit: 1,
                }));
                if (members.results.length === 0) {
                    Toast.error('Lid niet (meer) gevonden');
                    throw new Error('Member not found');
                }
                return new ComponentWithProperties(MemberSegmentedView, {
                    member: members.results[0],
                });
            },
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>
