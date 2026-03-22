<template>
    <div class="container">
        <Title v-bind="$attrs" :title="$t(`%XH`)" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="visibleParents.length === 0" class="info-box">
            {{ $t('%fT', {member: member.patchedMember.details.firstName}) }}
        </p>

        <STList v-else :with-animation="true">
            <STListItem v-if="app !== 'registration' && auth.canAccessPlatformMember(member, PermissionLevel.Write)" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="parentsHaveAccess" :indeterminate="!parentsHaveAccessChangeDate" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%1Hc') }}
                </h3>
                <p v-if="!parentsHaveAccessChangeDate && parentsHaveAccess" class="style-description-small">
                    {{ $t('%1Hd', {firstName: member.patchedMember.details.firstName}) }}
                </p>
                <p v-else-if="parentsHaveAccess" class="style-description-small">
                    {{ $t('%1He', {firstName: member.patchedMember.details.firstName}) }}
                    <I18nComponent v-if="member.patchedMember.details.defaultAge < 18" :t="$t('%1Hf', {firstName: member.patchedMember.details.firstName})">
                        <template #button="{content}">
                            <button class="inline-link" type="button" @click="clearParentsHaveAccess">
                                {{ content }}
                            </button>
                        </template>
                    </I18nComponent>
                </p>
                <p v-else class="style-description-small">
                    {{ $t('%1Hg', {firstName: member.patchedMember.details.firstName}) }}
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
                    {{ $t('%fU') }}: {{ parent.nationalRegisterNumber }}
                </p>

                <template #right>
                    <span v-if="!isParentSelected(parent)" class="button text limit-space">
                        <span class="icon add" />
                        <span>{{ $t('%SN') }}</span>
                    </span>

                    <button v-else class="button text limit-space" type="button" @click.stop="editParent(parent)">
                        <span class="icon edit" />
                        <span>{{ $t('%f9') }}</span>
                    </button>
                </template>
            </STListItem>
        </STList>

        <div class="style-button-bar">
            <button type="button" class="button text" :class="{selected: visibleParents.length <= 1}" @click="addParent()">
                <span class="icon add" />
                <span>{{ $t('%fV') }}</span>
            </button>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('%fC') }} {{ formatDate(reviewDate) }}. <button type="button" class="inline-link" :v-tooltip="$t('%fD')" @click="clear">
                {{ $t('%fE') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import type { PlatformMember } from '@stamhoofd/structures';
import { BooleanStatus, Parent, PermissionLevel } from '@stamhoofd/structures';

import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { computed, nextTick } from 'vue';
import { useAppContext } from '../../../context';
import { ErrorBox } from '../../../errors/ErrorBox';
import type { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import STList from '../../../layout/STList.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import EditParentView from './EditParentView.vue';
import Title from './Title.vue';
import { useAuth } from '../../../hooks';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';

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
            message: $t(`%107`),
            field: 'parents',
        }));
    }
    else if (parents.value.length > 0 && !parents.value.some(p => !!p.nationalRegisterNumber) && isPropertyRequired('parents.nationalRegisterNumber')) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%108`),
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
                message: $t('%1NR', { 
                    parentName: props.member.patchedMember.details.parents.find(p => p.phone === props.member.patchedMember.details.phone)?.firstName ?? $t('%1NQ'),
                    firstName: props.member.patchedMember.details.firstName
                }),
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
                message: $t('%1NS', { 
                    parentName: props.member.patchedMember.details.parents.find(p => p.email === props.member.patchedMember.details.email)?.firstName ?? $t('%1NQ'),
                    firstName: props.member.patchedMember.details.firstName 
                }),
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
