<template>
    <div class="container">
        <Title v-bind="$attrs" :title="$t(`00306f91-9f66-4cc3-9c8e-36c08f9964d7`)" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="visibleParents.length === 0" class="info-box">
            {{ $t('63ccb420-e7ca-4b0a-a8a7-403a40f670a1', {member: member.patchedMember.details.firstName}) }}
        </p>

        <STList v-else :with-animation="true">
            <STListItem v-if="app !== 'registration' && auth.canAccessPlatformMember(member, PermissionLevel.Write)" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="parentsHaveAccess" :indeterminate="!parentsHaveAccessChangeDate" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('2f657935-44b2-4fd6-baaa-a89b7b4da83d') }}
                </h3>
                <p v-if="!parentsHaveAccessChangeDate && parentsHaveAccess" class="style-description-small">
                    {{ $t('810b15cd-001e-4ab9-9d9e-054044904879', {firstName: member.patchedMember.details.firstName}) }}
                </p>
                <p v-else-if="parentsHaveAccess" class="style-description-small">
                    {{ $t('a9439a82-82d3-4254-a3a6-abe14952a392', {firstName: member.patchedMember.details.firstName}) }}
                    <I18nComponent v-if="member.patchedMember.details.defaultAge < 18" :t="$t('d5ee5112-988f-4d4b-82e0-46f257c40bbb', {firstName: member.patchedMember.details.firstName})">
                        <template #button="{content}">
                            <button class="inline-link" type="button" @click="clearParentsHaveAccess">
                                {{ content }}
                            </button>
                        </template>
                    </I18nComponent>
                </p>
                <p v-else class="style-description-small">
                    {{ $t('78c16cd9-a935-4382-9828-7b30d9808e0f', {firstName: member.patchedMember.details.firstName}) }}
                </p>
            </STListItem>

            <STListItem v-for="parent in visibleParents" :key="parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Checkbox :model-value="isParentSelected(parent)" @update:model-value="setParentSelected(parent, $event)" />
                </template>

                <h3 class="style-title-list">
                    {{ parent.firstName }} {{ parent.lastName }}
                </h3>
                <p v-if="parent.phone" class="style-description-small">
                    {{ parent.phone }}
                </p>
                <p v-if="parent.email" class="style-description-small">
                    {{ parent.email }}
                </p>
                <p v-if="parent.address" class="style-description-small">
                    {{ parent.address }}
                </p>
                <p v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                    {{ $t('9ce60d74-86a4-420f-92ab-91fb536a79be') }}: {{ parent.nationalRegisterNumber }}
                </p>

                <template #right>
                    <span v-if="!isParentSelected(parent)" class="button text limit-space">
                        <span class="icon add" />
                        <span>{{ $t('36ba68cb-2159-4179-8ded-89e73d47cd87') }}</span>
                    </span>

                    <button v-else class="button text limit-space" type="button" @click.stop="editParent(parent)">
                        <span class="icon edit" />
                        <span>{{ $t('ad3ad207-6470-4f3e-aaf4-1ea5ea8b85ad') }}</span>
                    </button>
                </template>
            </STListItem>
        </STList>

        <div class="style-button-bar">
            <button type="button" class="button text" :class="{selected: visibleParents.length <= 1}" @click="addParent()">
                <span class="icon add" />
                <span>{{ $t('6d4c2c27-ac05-4843-b329-c8bb806bfcb0') }}</span>
            </button>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('78dedb37-a33d-4907-8034-43345eea18a0') }} {{ formatDate(reviewDate) }}. <button type="button" class="inline-link" :v-tooltip="$t('1452c1a3-6203-4ab2-92c4-c0496661cd21')" @click="clear">
                {{ $t('74366859-3259-4393-865e-9baa8934327a') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { BooleanStatus, Parent, PermissionLevel, PlatformMember } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { computed, nextTick } from 'vue';
import { useAppContext } from '../../../context';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import STList from '../../../layout/STList.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import EditParentView from './EditParentView.vue';
import Title from './Title.vue';
import { useAuth } from '../../../hooks';
import { I18nComponent } from '@stamhoofd/frontend-i18n';

defineOptions({
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox;
    willMarkReviewed?: boolean;
}>();

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const present = usePresent();
const errors = useErrors({ validator: props.validator });
const auth = useAuth();

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (parents.value.length === 0 && isPropertyRequired('parents')) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`372836f6-9b19-49b6-b6d9-5afe781d836e`),
            field: 'parents',
        }));
    }
    else if (parents.value.length > 0 && !parents.value.some(p => !!p.nationalRegisterNumber) && isPropertyRequired('parents.nationalRegisterNumber')) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`ccc74056-d922-4af6-8318-4e797e0fd35e`),
            field: 'parents',
        }));
    }

    if (props.member.patchedMember.details.phone) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.phone === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het GSM-nummer van een ouder niet opgeven als het GSM-nummer van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het GSM-nummer van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'phone',
            }));
        }
    }

    if (props.member.patchedMember.details.email) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.email === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het e-mailadres van een ouder niet opgeven als het e-mailadres van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het e-mailadres van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'email',
            }));
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }
    errors.errorBox = null;

    return true;
});
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const initialParents = computed(() => props.member.member.details.parents);
const parents = computed(() => props.member.patchedMember.details.parents);

const visibleParents = computed(() => {
    // combine both unique
    const result: Parent[] = [];
    for (const parent of parents.value) {
        if (!result.find(p => p.id === parent.id)) {
            result.push(parent);
        }
    }

    for (const parent of initialParents.value) {
        if (!result.find(p => p.id === parent.id)) {
            result.push(parent);
        }
    }

    // Loop family members
    for (const member of props.member.family.members) {
        for (const parent of member.patchedMember.details.parents) {
            if (!result.find(p => p.id === parent.id)) {
                result.push(parent);
            }
        }
    }

    return result;
});

function isParentSelected(parent: Parent) {
    return !!parents.value.find(p => p.id === parent.id);
}
function setParentSelected(parent: Parent, selected: boolean) {
    if (selected === isParentSelected(parent)) {
        return;
    }
    // Check if parent is present?
    if (selected) {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        patch.addDelete(parent.id); // avoids creating duplicates
        patch.addPut(parent);
        props.member.addDetailsPatch({ parents: patch });
    }
    else {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        patch.addDelete(parent.id);
        props.member.addDetailsPatch({ parents: patch });
    }
}

async function editParent(parent: Parent) {
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addParent() {
    const parent = Parent.create({});
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('parents');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('parents');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

useValidation(props.validator, async () => {
    if (props.willMarkReviewed && (app !== 'registration' && auth.canAccessPlatformMember(props.member, PermissionLevel.Write))) {
        // Force saving: increase saved date + make sure it is not null
        parentsHaveAccess.value = parentsHaveAccess.value as any;
        await nextTick();
    }
    return true;
});

function clearParentsHaveAccess() {
    props.member.addDetailsPatch({
        parentsHaveAccess: null,
    });
}

const parentsHaveAccessChangeDate = computed(() => props.member.patchedMember.details.parentsHaveAccess?.date ?? null);
const parentsHaveAccess = computed({
    get: () => props.member.patchedMember.details.parentsHaveAccess?.value ?? props.member.patchedMember.details.calculatedParentsHaveAccess,
    set: (parentsHaveAccess) => {
        if (parentsHaveAccess === (props.member.member.details.parentsHaveAccess?.value ?? false) && !props.willMarkReviewed) {
            return props.member.addDetailsPatch({
                parentsHaveAccess: props.member.member.details.parentsHaveAccess ?? BooleanStatus.create({
                    value: parentsHaveAccess,
                }),
            });
        }
        return props.member.addDetailsPatch({
            parentsHaveAccess: BooleanStatus.create({
                value: parentsHaveAccess,
            }),
        });
    },
});
</script>
