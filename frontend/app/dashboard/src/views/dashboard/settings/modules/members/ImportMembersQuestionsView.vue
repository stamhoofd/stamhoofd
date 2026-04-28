<template>
    <SaveView :title="$t('%18D')" :loading="saving" :save-text="`Importeer ${importMemberResults.length} leden`" @save="goNext">
        <h1>{{ saving ? $t('%1Bt') : $t('%18k') }}</h1>
        <p v-if="!saving">
            {{ $t('%18l') }}
        </p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!saving">
            <p v-if="existingCount > 0 && existingCount === importMemberResults.length" class="warning-box">
                {{ $t('%18m') }} <template v-if="membersWithNewRegistrations.length">
                    {{ $t('%18n') }}
                </template>{{ $t('%18o') }}
            </p>
            <p v-else-if="existingCount > 0" class="warning-box">
                {{ $t('%19o', {
                    existingCount,
                    memberTranslation: existingCount == 1 ? $t('%79') : $t('%It'),
                    total: importMemberResults.length
                }) }}
            </p>

            <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                {{ $t('%18p', {count: deletedRegistrationsCount}) }}
            </p>
            <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                {{ $t('%18q', {count: membersWithoutNewRegistrations.length}) }}
            </p>

            <template v-if="membersWithNewRegistrations.length">
                <hr>
                <h2>{{ $t('%18r') }}</h2>

                <STInputBox v-if="hasWaitingLists" error-fields="waitingList" :error-box="errors.errorBox" class="max" :title="$t(`%19C`)">
                    <RadioGroup>
                        <Radio v-model="isWaitingList" :value="false">
                            {{ $t('%18s') }}
                        </Radio>
                        <Radio v-model="isWaitingList" :value="true">
                            {{ $t('%18t') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <p v-if="waitingListWarning" class="warning-box">
                    {{ waitingListWarning }}
                </p>

                <template v-if="!isWaitingList">
                    <STInputBox v-if="needsPaidStatus" :title="$t(`%19D`)" error-fields="paid" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="paid" :value="true">
                                {{ $t('%18u') }}
                            </Radio>
                            <Radio v-model="paid" :value="false">
                                {{ $t('%18v') }}
                            </Radio>
                            <Radio v-model="paid" :value="null">
                                {{ $t('%18w') }}
                            </Radio>
                        </RadioGroup>
                    </STInputBox>
                    <p v-if="!needsPaidStatus && somePaid" class="success-box">
                        {{ $t('%18x') }}
                    </p>

                    <p v-if="needsPaidStatus && somePaid" class="warning-box">
                        {{ $t('%18y') }}
                    </p>

                    <p v-if="needsPaidStatus && paid === null" class="warning-box">
                        {{ $t("%19B") }}
                    </p>
                </template>
            </template>

            <template v-if="needsGroupAssignment">
                <hr>
                <h2>{{ $t('%1IL') }}</h2>

                <p class="warning-box">
                    {{ membersNeedingAssignment.length }} {{ $t('%18z') }}
                </p>

                <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`%19E`)">
                    <RadioGroup>
                        <Radio v-model="autoAssign" :value="true">
                            {{ $t('%190') }}
                        </Radio>
                        <Radio v-model="autoAssign" :value="false">
                            {{ $t('%191') }}
                        </Radio>
                    </RadioGroup>

                    <template #right>
                        <button class="button text" type="button" @click.stop="openAssignment">
                            <span class="icon help" />
                            <span>{{ $t('%192') }}</span>
                        </button>
                    </template>
                </STInputBox>

                <template v-if="autoAssign">
                    <STInputBox v-if="membersWithMultipleGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`%19F`)">
                        <p class="info-box">
                            {{ $t('%19p', {
                                count: membersWithMultipleGroups.length,
                                memberTranslation: membersWithMultipleGroups.length == 1 ? $t('%193') : $t('%194')
                            }) }}
                        </p>

                        <STList v-model="draggableGroups" :draggable="true">
                            <template #item="{item: group, index}">
                                <STListItem class="right-description">
                                    {{ index + 1 }}. {{ group.settings.name }}

                                    <template #right>
                                        <span>{{ getGroupAutoAssignCountForPriority(group) }}</span>
                                        <button class="button icon external" type="button" @click="openPriorityAssignedToGroup(group)" />
                                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                    </template>
                                </STListItem>
                            </template>
                        </STList>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openMultipleGroups">
                                <span class="icon help" />
                                <span>{{ $t('%195') }}</span>
                            </button>
                        </template>
                    </STInputBox>

                    <STInputBox v-if="membersWithoutMatchingGroups.length > 0" error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`%19G`)">
                        <p class="info-box">
                            {{ $t('%196', {count: membersWithoutMatchingGroups.length}) }}
                        </p>

                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>

                        <template #right>
                            <button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                <span class="icon help" />
                                <span>{{ $t('%195') }}</span>
                            </button>
                        </template>
                    </STInputBox>
                </template>
                <template v-else>
                    <STInputBox error-fields="group" :error-box="errors.errorBox" class="max" :title="$t(`%19H`)">
                        <Dropdown v-model="defaultGroup">
                            <option v-for="group in groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </template>
            </template>

            <hr>

            <STList>
                <STListItem :selectable="true" @click.prevent="openResultView">
                    <template #left>
                        <span class="icon eye" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%197') }}
                    </h3>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { usePlatformFamilyManager } from '@stamhoofd/components/members/PlatformFamilyManager.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Group, OrganizationRegistrationPeriod, Parent, Registration } from '@stamhoofd/structures';
import { getGenderName, GroupType, ParentTypeHelper } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import type { Ref} from 'vue';
import { computed, ref, watch } from 'vue';
import type { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';
import ImportAutoAssignedView from './ImportAutoAssignedView.vue';
import ImportMembersErrorReportView from './ImportMembersErrorReportView.vue';
import { MemberImporter } from './MemberImporter';

const props = defineProps<{
    period: OrganizationRegistrationPeriod;
    importMemberResults: ImportMemberResult[];
}>();

const present = usePresent();
const errors = useErrors();
const platform = usePlatform();
const platformFamilyManager = usePlatformFamilyManager();
const navigate = useNavigationActions();
const organization = useRequiredOrganization();
const saving = ref(false);
const paid = ref<boolean | null>(null);
const isWaitingList = ref(false);
const autoAssign = ref(true);
const groups = props.period.groups;
const defaultGroup = ref(groups[0]) as unknown as Ref<Group>;
const multipleGroups = ref(calculateMultipleGroups(groups)) as unknown as Ref<Group[]>;
const owner = useRequestOwner();
const context = useContext();
const show = useShow();
const pop = usePop();

const memberImporter = new MemberImporter({
    platform: platform.value,
    organization: organization.value,
    period: props.period,
    platformFamilyManager: platformFamilyManager,
    context: context.value,
    requestOwner: owner,
});

watch([autoAssign, defaultGroup], () => {
    autoAssignMembers(props.importMemberResults);
});

const needsPaidStatus = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.importRegistrationResult.paid === null && m.importRegistrationResult.paidPrice === null);
});

const somePaid = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.importRegistrationResult.paid !== null || m.importRegistrationResult.paidPrice !== null);
});

const needsGroupAssignment = computed(() => membersNeedingAssignment.value.length > 0);
const existingCount = computed(() => props.importMemberResults.filter(m => m.isExisting).length);
const hasWaitingLists = !!groups.find(g => g.waitingList !== null);

const membersNeedingAssignment = computed(() => {
    return props.importMemberResults.filter((m) => {
        return shouldAssignRegistrationToMember(m);
    });
});

const waitingListWarning = computed(() => {
    if (!isWaitingList.value) {
        return null;
    }

    const groupMap = new Map<string, Group>();

    for (const member of props.importMemberResults) {
        const registrationData = memberImporter.buildRegistration(member, isWaitingList.value);

        if (registrationData && registrationData.group.type !== GroupType.WaitingList) {
            if (groupMap.has(registrationData.group.id)) {
                continue;
            }
            groupMap.set(registrationData.group.id, registrationData.group);
        }
    }

    if (!groupMap.size) {
        return null;
    }

    return $t('%1Bu', { groups: Formatter.joinLast(Array.from(groupMap.values()).map(g => g.settings.name.toString()), ', ', ' ' + $t('en') + ' ') });
});

const membersWithNewRegistrations = computed(() => props.importMemberResults.filter(m => memberImporter.hasNewRegistration(m, isWaitingList.value)));

const membersWithoutNewRegistrations = computed(() => props.importMemberResults.filter(m => !memberImporter.hasNewRegistration(m, isWaitingList.value)));

const deletedRegistrationsCount = computed(() => {
    return membersWithNewRegistrations.value.reduce((acc, m) => {
        const registration = memberImporter.buildRegistration(m, isWaitingList.value);
        if (!registration) {
            return acc;
        }
        return acc + memberImporter.getOverrideRegistrations(registration, m).length;
    }, 0);
});

function isValidRegistration(registration: Registration) {
    return registration.deactivatedAt === null && registration.registeredAt !== null;
}

function shouldAssignRegistrationToMember(m: ImportMemberResult) {
    if (m.importRegistrationResult.group !== null) {
        return false;
    }

    const activeRegistrations = m.existingMember?.member.registrations.filter(r => isValidRegistration(r)) ?? [];
    const waitingGroups = m.existingMember?.member.registrations.filter(r => isValidRegistration(r) && r.group.type === GroupType.WaitingList) ?? [];

    if (activeRegistrations.length > 0 && !isWaitingList.value) {
        return false;
    }

    if (waitingGroups.length > 0 && isWaitingList.value) {
        return false;
    }

    return true;
}

const membersWithMultipleGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const matchedGroups = m.patchedDetails.getMatchingGroups(groups);
        return (matchedGroups.length > 1);
    });
});

const membersWithoutMatchingGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const matchedGroups = m.patchedDetails.getMatchingGroups(groups);
        return (matchedGroups.length === 0);
    });
});

/**
 * Groups for which we need to set a priority, because some members fit in more than one of them
 */
function calculateMultipleGroups(groups: Group[]) {
    const filteredGroups = groups.filter(g => g.type === GroupType.Membership);
    const multipleGroups = new Map<string, Group>();

    for (const member of props.importMemberResults) {
        if (member.importRegistrationResult.group !== null) {
            continue;
        }
        const g = member.patchedDetails.getMatchingGroups(filteredGroups);
        if (g.length > 1) {
            for (const gg of g) {
                multipleGroups.set(gg.id, gg);
            }
        }
    }
    return [...multipleGroups.values()].sort((a, b) => -Sorter.stack(Sorter.byNumberValue(a.settings.maxAge ?? 9, b.settings.maxAge ?? 99), Sorter.byNumberValue(a.settings.minAge ?? 0, b.settings.minAge ?? 0)));
}

/**
 * Map these members to their corresponding group (id), using priority, default etc
 */
function autoAssignMembers(members: ImportMemberResult[]) {
    for (const member of members) {
        if (!shouldAssignRegistrationToMember(member)) {
            member.importRegistrationResult.autoAssignedGroup = null;
            continue;
        }

        if (!autoAssign.value) {
            member.importRegistrationResult.autoAssignedGroup = defaultGroup.value;
            continue;
        }

        const g = member.patchedDetails.getMatchingGroups(groups);
        if (g.length === 0) {
            member.importRegistrationResult.autoAssignedGroup = defaultGroup.value;
        }
        else if (g.length === 1) {
            member.importRegistrationResult.autoAssignedGroup = g[0];
        }
        else {
            // Get group that is first in the priority queue (= multipleGroups)
            member.importRegistrationResult.autoAssignedGroup = multipleGroups.value.find((group) => {
                return (g.includes(group));
            }) ?? defaultGroup.value;
        }
    }
}

function getGroupAutoAssignCountForPriority(group: Group) {
    autoAssignMembers(membersWithMultipleGroups.value);
    return membersWithMultipleGroups.value.reduce((current, member) => {
        if (member.importRegistrationResult.autoAssignedGroup && member.importRegistrationResult.autoAssignedGroup.id === group.id) {
            return current + 1;
        }
        return current;
    }, 0);
}

function openAssignment() {
    autoAssignMembers(props.importMemberResults);
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`%19I`),
        description: $t(`%19J`),
        members: membersNeedingAssignment.value.flatMap((m) => {
            if (m.importRegistrationResult.autoAssignedGroup === null) {
                return [];
            }

            return [{
                name: m.patchedDetails.name,
                description: m.importRegistrationResult.autoAssignedGroup.settings.name,
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openPriorityAssignedToGroup(group: Group) {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`%19K`, { group: group.settings.name }),
        description: $t(`%19L`, { group: group.settings.name }),
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.importRegistrationResult.group !== null) {
                return [];
            }

            if (m.importRegistrationResult.autoAssignedGroup?.id === group.id) {
                const matchingGroups = m.patchedDetails.getMatchingGroups(groups);
                return [{
                    name: m.patchedDetails.name,
                    description: matchingGroups.map(g => g.settings.name).join(', '),
                }];
            }

            return [];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openMultipleGroups() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`%19M`),
        description: $t(`%19N`),
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.importRegistrationResult.group !== null) {
                return [];
            }

            const matchingGroups = m.patchedDetails.getMatchingGroups(groups);
            return [{
                name: m.patchedDetails.name,
                description: matchingGroups.map(g => g.settings.name).join(', '),
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function getParentDescription(parent: Parent) {
    const description: string[] = [];
    const type = ParentTypeHelper.getName(parent.type);
    if (parent.name.trim()) {
        description.push(type + ': ' + parent.name);
    }
    if (parent.phone) {
        description.push(type + ' ' + $t(`%zY`) + ': ' + parent.phone);
    }
    if (parent.email) {
        description.push(type + ' ' + $t(`%19O`) + ': ' + parent.email);
    }
    if (parent.address) {
        description.push(type + ' ' + $t(`%19P`) + ': ' + parent.address.toString());
    }
    if (parent.nationalRegisterNumber) {
        description.push(type + ' ' + $t(`%19Q`) + ': ' + parent.nationalRegisterNumber.toString());
    }
    return description;
}

function openResultView() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`%19R`),
        description: $t(`%19S`),
        members: props.importMemberResults.map((member) => {
            const description: string[] = [];
            const registration = memberImporter.buildRegistration(member, isWaitingList.value);

            if (registration !== null) {
                const group = groups.find(g => g.id === registration.group.id);
                const groupName = (group?.settings.name ?? $t(`%19T`));

                let suffix = '';

                if (member.importRegistrationResult.paidPrice !== null) {
                    suffix = ` (${$t('%gi', { price: Formatter.price(member.importRegistrationResult.paidPrice) })})`;
                }
                else if (member.importRegistrationResult.paid || paid.value) {
                    suffix = ` (${$t('%198')})`;
                }
                else {
                    suffix = ` (${$t('%199')})`;
                }

                if (member.existingMember) {
                    if (registration !== null) {
                        if (registration.group.type === GroupType.WaitingList) {
                            description.push($t(`%1Bv`, { group: groupName }) + suffix);
                        }
                        else {
                            description.push($t(`%19U`, { group: groupName }) + suffix);
                        }

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = memberImporter.getOverrideRegistrations(registration, member);
                        for (const r of deleteRegs) {
                            const groupName = (groups.find(g => g.id === r.groupId)?.settings.name ?? $t(`%19T`));
                            if (r.group.type === GroupType.WaitingList) {
                                description.push($t(`%19V`, { group: groupName }));
                            }
                            else {
                                description.push($t(`%19W`, { group: groupName }));
                            }
                        }
                    }
                }
                else {
                    if (registration.group.type === GroupType.WaitingList) {
                        description.push($t(`%1Bw`, { group: groupName }) + suffix);
                    }
                    else {
                        description.push($t(`%19X`, { group: groupName }) + suffix);
                    }
                }
            }
            else if (member.isExisting) {
                description.push($t(`%19Y`));
            }

            if (member.existingMember) {
                const existingDetails = member.existingMember.member.details;
                const patched = member.patchedDetails;

                if (patched.name !== undefined && existingDetails.name !== patched.name) {
                    description.push($t(`%19Z`, { name: patched.name }));
                }
                if (patched.nationalRegisterNumber && patched.nationalRegisterNumber !== existingDetails.nationalRegisterNumber) {
                    description.push($t(`%19a`, { nationalRegisterNumber: patched.nationalRegisterNumber.toString() }));
                }
                if (patched.gender !== undefined && existingDetails.gender !== patched.gender) {
                    description.push($t(`%19b`, { gender: getGenderName(patched.gender) }));
                }
                if (patched.email !== undefined && patched.email && existingDetails.email !== patched.email) {
                    description.push($t(`%19c`, { email: patched.email }));
                }
                if (patched.phone !== undefined && patched.phone && existingDetails.phone !== patched.phone) {
                    description.push($t(`%19d`, { phone: patched.phone }));
                }
                if (patched.birthDay && (!existingDetails.birthDay || (Formatter.dateIso(existingDetails.birthDay) !== Formatter.dateIso(patched.birthDay)))) {
                    description.push($t(`%19e`, { birthDay: Formatter.date(patched.birthDay, true) }));
                }

                if (patched.address && patched.address.toString() !== existingDetails.address?.toString()) {
                    description.push($t(`%19f`, { address: patched.address.toString() }));
                }

                if (patched.memberNumber && patched.memberNumber !== existingDetails.memberNumber) {
                    description.push($t(`%19g`, { memberNumber: patched.memberNumber }));
                }

                if (patched.uitpasNumberDetails && patched.uitpasNumberDetails.uitpasNumber !== existingDetails.uitpasNumberDetails?.uitpasNumber) {
                    description.push($t(`%19h`, { number: patched.uitpasNumberDetails.uitpasNumber }));
                }

                for (const parent of member.getChangedParents()) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of member.getChangedRecordAnswers()) {
                    description.push($t('%19A', { key: answer.settings.name, value: answer.stringValue }));
                }
            }
            else {
                const patched = member.patchedDetails;

                if (patched.name) {
                    description.push($t(`%1Os`) + ': ' + patched.name);
                }
                if (patched.nationalRegisterNumber) {
                    description.push($t(`%wK`) + ': ' + patched.nationalRegisterNumber.toString());
                }
                if (patched.gender) {
                    description.push($t(`%19i`) + ': ' + getGenderName(patched.gender));
                }
                if (patched.email) {
                    description.push($t(`%xB`) + ': ' + patched.email);
                }
                if (patched.phone) {
                    description.push($t(`%wD`) + ': ' + patched.phone);
                }
                if (patched.birthDay) {
                    description.push($t(`%17w`) + ': ' + Formatter.date(patched.birthDay, true));
                }

                if (patched.address) {
                    description.push($t(`%Cn`) + ': ' + patched.address.toString());
                }

                if (patched.memberNumber) {
                    description.push($t(`%19j`) + ': ' + patched.memberNumber);
                }

                if (patched.uitpasNumberDetails) {
                    description.push($t(`%wF`) + ': ' + patched.uitpasNumberDetails.uitpasNumber);
                }

                for (const parent of patched.parents) {
                    description.push(...getParentDescription(parent));
                }

                for (const answer of patched.recordAnswers.values()) {
                    description.push($t('%19A', { key: answer.settings.name, value: answer.stringValue }));
                }
            }

            return {
                name: member.patchedDetails.name,
                description: description.join('\n'),
            };
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

const draggableGroups = computed({
    get: () => multipleGroups.value,
    set: (groups) => {
        if (groups.length !== multipleGroups.value.length) {
            return;
        }

        multipleGroups.value = groups;
    },
});

function openWithoutMatchingGroups() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: $t(`%19k`),
        description: $t(`%19l`),
        members: membersWithoutMatchingGroups.value.flatMap((m) => {
            return [{
                name: m.patchedDetails.name,
                group: '/',
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

async function goNext() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    const toast = new Toast($t(`%19m`), 'spinner').setHide(null).show();

    try {
        autoAssignMembers(props.importMemberResults);
        const reports = await memberImporter.importResults(props.importMemberResults, {
            isWaitingList: isWaitingList.value,
            paid: paid.value,
        }, progress => toast.setProgress(progress));

        toast.hide();

        if (reports.some(r => r.hasError)) {
            show(new ComponentWithProperties(ImportMembersErrorReportView, {
                reports,
                onNext: () => {
                    pop()?.catch(console.error);
                },
            })).catch(console.error);
        }
        else {
            new Toast($t(`%19n`), 'success green').show();
            navigate.dismiss({ force: true }).catch(console.error);
        }
    }
    catch (e) {
        toast.hide();
        console.error(e);
        Toast.fromError(e).show();
    }
    saving.value = false;
}
</script>
