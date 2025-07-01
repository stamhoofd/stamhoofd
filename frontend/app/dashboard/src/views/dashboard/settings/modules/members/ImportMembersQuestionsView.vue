<template>
    <div id="import-members-questions-view" class="st-view background">
        <STNavigationBar title="Leden importeren" :pop="canPop" :dismis="canDismiss" />

        <main>
            <h1>Importeer instellingen</h1>
            <p>We hebben nog wat aanvullende vragen over hoe we de leden moeten importeren.</p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="!saving">
                <p v-if="existingCount > 0 && existingCount === members.length" class="warning-box">
                    Alle leden uit jouw bestand zitten al in het systeem. Als je kolommen hebt met gegevensvelden gaan die de gegevens in Stamhoofd overschrijven. <template v-if="membersWithNewRegistrations.length">
                        Er zullen ook nieuwe inschrijvingen bij deze bestaande leden worden toegevoegd.
                    </template>Let goed op, je kan dit niet ongedaan maken.
                </p>
                <p v-else-if="existingCount > 0" class="warning-box">
                    {{ existingCount }} {{ existingCount == 1 ? 'lid' : 'leden' }} uit jouw bestand zitten al in het systeem ({{ members.length }} in totaal). Je gaat informatie in Stamhoofd overschrijven met informatie uit jouw bestand voor deze leden. Let goed op, je kan dit niet ongedaan maken.
                </p>

                <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                    Stamhoofd zal {{ deletedRegistrationsCount }} inschrijvingen of wachtlijst inschrijvingen verplaatsen voor bestaande leden op basis van jouw bestand.
                </p>
                <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                    {{ membersWithoutNewRegistrations.length }} leden uit jouw lijst zijn al ingeschreven. Hun huidige inschrijving(en) zullen niet worden aangepast, ze zullen ook geen nieuwe inschrijvingen krijgen. Hun andere gegevens uit het bestand zullen wel in Stamhoofd worden overgenomen.
                </p>

                <template v-if="membersWithNewRegistrations.length">
                    <hr>
                    <h2>Inschrijvingstatus</h2>

                    <STInputBox v-if="hasWaitingLists" title="Wil je deze leden op de wachtlijst zetten?" error-fields="waitingList" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="isWaitingList" :value="false">
                                Nee
                            </Radio>
                            <Radio v-model="isWaitingList" :value="true">
                                Ja, zet op wachtlijst
                            </Radio>
                        </RadioGroup>
                    </STInputBox>

                    <template v-if="!isWaitingList">
                        <STInputBox v-if="needsPaidStatus" :title="'Hebben deze leden al betaald?'" error-fields="paid" :error-box="errors.errorBox" class="max">
                            <RadioGroup>
                                <Radio v-model="paid" :value="true">
                                    Al betaald
                                </Radio>
                                <Radio v-model="paid" :value="false">
                                    Niet betaald
                                </Radio>
                                <Radio v-model="paid" :value="null">
                                    Sommigen wel, anderen niet
                                </Radio>
                            </RadioGroup>
                        </STInputBox>
                        <p v-if="!needsPaidStatus && somePaid" class="success-box">
                            De betaalstatus uit jouw Excel-bestand zal worden gebruikt om de inschrijvingen met het juiste bedrag aan te maken.
                        </p>

                        <p v-if="needsPaidStatus && somePaid" class="warning-box">
                            Van sommige leden hebben we in het bestand wel al de nodige betaalinformatie gevonden, bij hen wordt die informatie gebruikt en het bovenstaande genegeerd.
                        </p>

                        <p v-if="needsPaidStatus && paid === null" class="warning-box">
                            We zetten de betaalstatus van alle leden op 'niet betaald'. Jij moet achteraf dan aanduiden wie al betaald heeft. Als je dat niet wilt doen, kan je de betaalstatus opnemen in jouw bestand door een extra kolom 'Betaald' toe te voegen en daar ja/nee in te zetten.
                        </p>
                    </template>
                </template>

                <template v-if="needsGroupAssignment">
                    <hr>
                    <h2>Inschrijvingsgroep</h2>

                    <p class="warning-box">
                        {{ membersNeedingAssignment.length }} leden uit jouw lijst hebben geen inschrijvingsgroep toegewezen gekregen (in een kolom). Kies hieronder hoe je deze wilt inschrijven in de juiste groep, of voeg een kolom in jouw bestand toe met de groep waar je elk lid wilt inschrijven.
                    </p>

                    <STInputBox title="Leeftijdsgroep toewijzen" error-fields="group" :error-box="errors.errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="autoAssign" :value="true">
                                Automatisch groep bepalen
                            </Radio>
                            <Radio v-model="autoAssign" :value="false">
                                Allemaal in één groep inschrijven
                            </Radio>
                        </RadioGroup>

                        <template #right>
                            <button class="button text" type="button" @click.stop="openAssignment">
                                <span class="icon help" />
                                <span>Toon resultaat</span>
                            </button>
                        </template>
                    </STInputBox>

                    <template v-if="autoAssign">
                        <STInputBox v-if="membersWithMultipleGroups.length > 0" title="Prioriteit van groepen" error-fields="group" :error-box="errors.errorBox" class="max">
                            <p class="info-box">
                                {{ membersWithMultipleGroups.length }} {{ membersWithMultipleGroups.length == 1 ? 'lid past' : 'leden passen' }} in meer dan één groep. Je kan hieronder een prioriteit instellen. Dan schrijven we elk lid in bij één van groepen waar hij in past die de hoogste prioriteit heeft. Als je wilt kan je de leeftijd of geslacht van elke leeftijdsgroep (tijdelijk) beperken om op die manier automatisch de juiste leeftijdsgroep te kiezen (dat doe je bij instellingen > inschrijvingsgroepen)
                            </p>

                            <STList v-model="draggableGroups" :draggable="true">
                                <STListItem v-for="(group, index) of multipleGroups" :key="group.id" class="right-description">
                                    {{ index + 1 }}. {{ group.settings.name }}

                                    <template #right>
                                        <span>{{ getGroupAutoAssignCountForPriority(group) }}</span>
                                        <button class="button icon external" type="button" @click="openPriorityAssignedToGroup(group)" />
                                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                    </template>
                                </STListItem>
                            </STList>

                            <template #right>
                                <button type="button" class="button text" @click.stop="openMultipleGroups">
                                    <span class="icon help" />
                                    <span>Toon leden</span>
                                </button>
                            </template>
                        </STInputBox>

                        <STInputBox v-if="membersWithoutMatchingGroups.length > 0" title="In welke groep wil je leden inschrijven die nergens in passen?" error-fields="group" :error-box="errors.errorBox" class="max">
                            <p class="info-box">
                                {{ membersWithoutMatchingGroups.length }} leden passen in geen enkele groep. Kies hieronder in welke groep je deze toch wilt inschrijven.
                            </p>

                            <Dropdown v-model="defaultGroup">
                                <option v-for="group of patched.groups" :key="group.id" :value="group">
                                    {{ group.settings.name }}
                                </option>
                            </Dropdown>

                            <template #right>
                                <button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                    <span class="icon help" />
                                    <span>Toon leden</span>
                                </button>
                            </template>
                        </STInputBox>
                    </template>
                    <template v-else>
                        <STInputBox title="In welke groep wil je deze leden inschrijven?" error-fields="group" :error-box="errors.errorBox" class="max">
                            <Dropdown v-model="defaultGroup">
                                <option v-for="group of patched.groups" :key="group.id" :value="group">
                                    {{ group.settings.name }}
                                </option>
                            </Dropdown>
                        </STInputBox>
                    </template>
                </template>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <button type="button" class="button secundary" @click="openResultView">
                    Toon wijzigingen
                </button>

                <LoadingButton :loading="saving">
                    <button type="button" class="button primary" @click="goNext">
                        Importeer {{ members.length }} leden
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useCanDismiss, useCanPop, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { Dropdown, getDefaultItem, LoadingButton, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, useCheckoutRegisterItem, useContext, useErrors, usePatch } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { Gender, Group, GroupPrice, GroupType, Organization, OrganizationRegistrationPeriod, Parent, ParentTypeHelper, PlatformMember, RecordAnswer, Registration, RegistrationWithPlatformMember, TranslatedString } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ComputedRef, onMounted, Ref, ref } from 'vue';
import { ImportMemberResult } from '../../../../../classes/import/ExistingMemberResult';
import ImportAutoAssignedView from './ImportAutoAssignedView.vue';

const props = defineProps<{
    members: ImportMemberResult[];
}>();

const errors = useErrors();
const saving = ref(false);
const multipleGroups = ref([]) as Ref<Group[]>;
const present = usePresent();
const dismiss = useDismiss();
const canPop = useCanPop();
const canDismiss = useCanDismiss();

const organizationManager = useOrganizationManager();
const { patched } = usePatch(organizationManager.value.organization);

onMounted(() => {
    multipleGroups.value = calculateMultipleGroups();
    autoAssignMembers(props.members);
});

// todo: should these all be refs?
const paid = ref<boolean | null>(true);
const isWaitingList = ref(false);
const autoAssign = ref(true);
const defaultGroup = computed(() => patched.value.groups[0]);

const needsPaidStatus = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.registration.paid === null && m.registration.paidPrice === null);
});

const somePaid = computed(() => {
    return !!membersWithNewRegistrations.value.find(m => m.registration.paid !== null || m.registration.paidPrice !== null);
});

const needsGroupAssignment = computed(() => membersNeedingAssignment.value.length > 0);

const existingCount = computed(() => props.members.filter(m => m.isExisting).length);

// todo: groups is deprecated
const hasWaitingLists = computed(() => !!patched.value.groups.find(g => g.waitingList !== null));

const membersNeedingAssignment = computed(() => {
    return props.members.filter((m) => {
        return shouldAssignRegistrationToMember(m);
    });
});

const membersWithNewRegistrations = computed(() => props.members.filter(m => hasNewRegistration(m)));

const membersWithoutNewRegistrations = computed(() => props.members.filter(m => !hasNewRegistration(m)));

const deletedRegistrationsCount = computed(() => {
    return membersWithNewRegistrations.value.reduce((acc, m) => {
        const registration = buildRegistration(m);
        if (!registration) {
            return acc;
        }
        return acc + getOverrideRegistrations(registration, m).length;
    }, 0);
});

function shouldAssignRegistrationToMember(m: ImportMemberResult) {
    if (m.registration.group !== null) {
        return false;
    }

    const activeRegistrations = m.existingMember?.member.registrations.filter(r => r.isActive) ?? [];
    // todo: is this correct?
    const waingingGroups = m.existingMember?.member.registrations.filter(r => r.isActive && r.group.type === GroupType.WaitingList) ?? [];

    if (activeRegistrations.length > 0 && !isWaitingList.value) {
        return false;
    }

    if (waingingGroups.length > 0 && isWaitingList.value) {
        return false;
    }

    return true;
}

const membersWithMultipleGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const groups = m.patchedDetails.getMatchingGroups(patched.value.period.groups);
        return (groups.length > 1);
    });
});

const membersWithoutMatchingGroups = computed(() => {
    return membersNeedingAssignment.value.filter((m) => {
        const groups = m.patchedDetails.getMatchingGroups(patched.value.period.groups);
        return (groups.length === 0);
    });
});

/**
     * Groups for which we need to set a priority, because some members fit in more than one of them
     */
function calculateMultipleGroups() {
    const groups = new Map<string, Group>();
    for (const member of props.members) {
        if (member.registration.group !== null) {
            continue;
        }
        const g = member.patchedDetails.getMatchingGroups(patched.value.period.groups);
        if (g.length > 1) {
            for (const gg of g) {
                groups.set(gg.id, gg);
            }
        }
    }
    return [...groups.values()].sort((a, b) => -Sorter.stack(Sorter.byNumberValue(a.settings.maxAge ?? 9, b.settings.maxAge ?? 99), Sorter.byNumberValue(a.settings.minAge ?? 0, b.settings.minAge ?? 0)));
}

/**
     * Map these members to their corresponding group (id), using priority, default etc
     */
function autoAssignMembers(members: ImportMemberResult[]) {
    for (const member of members) {
        if (!shouldAssignRegistrationToMember(member)) {
            member.registration.autoAssignedGroup = null;
            continue;
        }

        if (!autoAssign.value) {
            // TODO: use default group for all
            member.registration.autoAssignedGroup = defaultGroup.value;
            continue;
        }

        const g = member.patchedDetails.getMatchingGroups(patched.value.period.groups);
        if (g.length === 0) {
            // use default: todo
            member.registration.autoAssignedGroup = defaultGroup.value;
        }
        else if (g.length === 1) {
            member.registration.autoAssignedGroup = g[0];
        }
        else {
            // Get group that is first in the priority queue (= multipleGroups)
            member.registration.autoAssignedGroup = multipleGroups.value.find((group) => {
                return (g.includes(group));
            }) ?? defaultGroup.value;
        }
    }
}

function getGroupAutoAssignCountForPriority(group: Group) {
    autoAssignMembers(membersWithMultipleGroups.value);
    return membersWithMultipleGroups.value.reduce((current, member) => {
        if (member.registration.autoAssignedGroup && member.registration.autoAssignedGroup.id === group.id) {
            return current + 1;
        }
        return current;
    }, 0);
}

function openAssignment() {
    autoAssignMembers(props.members);
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: 'Wijzigingen aan inschrijvingen',
        description: 'Hier zie je bij welke groep we elk lid gaan inschrijven, op basis van jouw instellingen en het bestand',
        members: membersNeedingAssignment.value.flatMap((m) => {
            if (m.registration.autoAssignedGroup === null) {
                return [];
            }

            return [{
                name: m.patchedDetails.name,
                description: m.registration.autoAssignedGroup.settings.name,
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openPriorityAssignedToGroup(group: Group) {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: 'Leden die door prioriteit bij ' + group.settings.name + ' zullen worden ingeschreven',
        description: 'Deze leden passen in meerdere groepen, maar op basis van jouw prioriteit bij ' + group.settings.name + ' zullen worden ingeschreven',
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.registration.group !== null) {
                return [];
            }

            if (m.registration.autoAssignedGroup?.id === group.id) {
                const groups = m.patchedDetails.getMatchingGroups(patched.value.period.groups);
                return [{
                    name: m.patchedDetails.name,
                    description: groups.map(g => g.settings.name).join(', '),
                }];
            }

            return [];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function openMultipleGroups() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: 'Leden die in meerdere groepen passen',
        description: 'Dit zijn alle leden en de groepen waar ze in passen. Je kan beperken tot welke groepen ze horen door de instellingen van die groep te wijzigen.',
        members: membersWithMultipleGroups.value.flatMap((m) => {
            if (m.registration.group !== null) {
                return [];
            }

            const groups = m.patchedDetails.getMatchingGroups(patched.value.period.groups);
            return [{
                name: m.patchedDetails.name,
                description: groups.map(g => g.settings.name).join(', '),
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function getParentDescription(parent: Parent) {
    const description: string[] = [];
    let type = ParentTypeHelper.getName(parent.type);
    if (parent.name.trim()) {
        description.push(type + ': ' + parent.name);
    }
    if (parent.phone) {
        description.push(type + ' telefoonnummer: ' + parent.phone);
    }
    if (parent.email) {
        description.push(type + ' e-mail: ' + parent.email);
    }
    if (parent.address) {
        description.push(type + ' adres: ' + parent.address.toString());
    }
    return description;
}

function openResultView() {
    present(new ComponentWithProperties(ImportAutoAssignedView, {
        title: 'Wijzigingen',
        description: 'Dit is een overzicht van alle wijzigingen die we gaan doorvoeren als je verder gaat met deze import.',
        members: props.members.map((member) => {
            let description: string[] = [];
            const registration = buildRegistration(member);

            if (registration !== null) {
                const group = groups.value.find(g => g.id === registration.groupId);
                const groupName = (group?.settings.name ?? 'onbekende groep');

                if (member.existingMember) {
                    if (registration !== null) {
                        let suffix = '';
                        if (registration.pricePaid) {
                            suffix += ' (' + Formatter.price(registration.pricePaid) + ' betaald)';
                        }
                        if (registration.pricePaid !== registration.price) {
                            if (registration.price === 0) {
                                suffix += ' (gratis)';
                            }
                            else {
                                suffix += ' (' + Formatter.price(registration.pricePaid) + ' totaal te betalen)';
                            }
                        }

                        if (registration.isWaitingList) {
                            description.push('Wachtlijst plaatsen voor ' + groupName + suffix);
                        }
                        else {
                            description.push('Inschrijven voor ' + groupName + suffix);
                        }

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = getOverrideRegistrations(registration, member);
                        for (const r of deleteRegs) {
                            const groupName = (groups.value.find(g => g.id === r.groupId)?.settings.name ?? 'onbekende groep');
                            if (r.group.type === GroupType.WaitingList) {
                                description.push('Verwijderen van wachtlijst van ' + groupName);
                            }
                            else {
                                description.push('Verwijderen inschrijving voor ' + groupName);
                            }
                        }
                    }
                }
                else {
                    if (registration.isWaitingList) {
                        description.push('Toevoegen in het systeem en op wachtlijst plaatsen voor ' + groupName);
                    }
                    else {
                        description.push('Toevoegen in het systeem met inschrijving voor ' + groupName);
                    }
                }
            }
            else {
                description.push('Geen wijziging aan inschrijvingen');
            }

            if (member.existingMember) {
                const existingDetails = member.existingMember.member.details;
                const newDetails = member.getPatch();
                const patched = member.patchedDetails;

                // Data changes
                if (newDetails.name !== undefined && existingDetails.name !== newDetails.name) {
                    description.push('Naam wijzigen naar ' + newDetails.name);
                }
                if (newDetails.gender !== undefined && newDetails.gender !== Gender.Other && existingDetails.gender !== newDetails.gender) {
                    description.push('Geslacht wijzigen naar ' + newDetails.gender);
                }
                if (newDetails.email !== undefined && newDetails.email && existingDetails.email !== newDetails.email) {
                    description.push('E-mail wijzigen naar ' + newDetails.email);
                }
                if (newDetails.phone !== undefined && newDetails.phone && existingDetails.phone !== newDetails.phone) {
                    description.push('Telefoonnummer wijzigen naar ' + newDetails.phone);
                }
                if (newDetails.birthDay !== undefined && newDetails.birthDay && (!existingDetails.birthDay || Formatter.dateIso(existingDetails.birthDay) !== Formatter.dateIso(newDetails.birthDay))) {
                    description.push('Geboortedatum wijzigen naar ' + Formatter.date(newDetails.birthDay, true));
                }

                const changedParents = new Set<Parent>();

                if (newDetails.parents) {
                    for (const parentPatch of newDetails.parents.getPatches()) {
                        const parentId = parentPatch.id;

                        const parent = patched.parents.find(p => p.id === parentId);
                        if (parent) {
                            changedParents.add(parent);
                        }
                    }

                    for (const parentPut of newDetails.parents.getPuts()) {
                        changedParents.add(parentPut.put);
                    }
                }

                for (const parent of changedParents.values()) {
                    description.push(...getParentDescription(parent));
                }

                const changedRecordAnswers = new Set<RecordAnswer>();
                const existingRecordAnswers = [...existingDetails.recordAnswers.values()];

                for (const value of newDetails.recordAnswers?.values() ?? []) {
                    if (!value) {
                        continue;
                    }

                    if (value.isPut()) {
                        changedRecordAnswers.add(value);
                    }
                    else {
                        const existingRecordAnswer = existingRecordAnswers.find(a => a.id === value.id);
                        if (existingRecordAnswer) {
                            changedRecordAnswers.add(existingRecordAnswer);
                        }
                    }
                }

                for (const answer of changedRecordAnswers.values()) {
                    description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue);
                }
            }
            else {
                // todo: test
                const patched = member.patchedDetails;

                // Data changes
                if (patched.name) {
                    description.push('Naam: ' + patched.name);
                }
                if (patched.gender !== Gender.Other) {
                    description.push('Geslacht: ' + patched.gender);
                }
                if (patched.email) {
                    description.push('E-mail: ' + patched.email);
                }
                if (patched.phone) {
                    description.push('Telefoonnummer: ' + patched.phone);
                }
                if (patched.birthDay) {
                    description.push('Geboortedatum: ' + Formatter.date(patched.birthDay, true));
                }
                for (const parent of patched.parents) {
                    // todo: is this correct?
                    description.push(...getParentDescription(parent));
                }

                for (const answer of patched.recordAnswers.values()) {
                    // todo: is this correct?
                    description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue);
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
        title: 'Leden die in geen enkele groep passen',
        description: 'Dit zijn alle leden waarvoor we geen geschikte leeftijdsgroep konden vinden: omdat ze te oud of te jong zijn bijvoorbeeld. Pas de instellingen van jouw inschrijvingsgroepen eventueel aan.',
        members: membersWithoutMatchingGroups.value.flatMap((m) => {
            return [{
                name: m.patchedDetails.name,
                group: '/',
            }];
        }),
    }).setDisplayStyle('popup')).catch(console.error);
}

function hasNewRegistration(member: ImportMemberResult) {
    const group = (member.registration.group ?? member.registration.autoAssignedGroup);

    if (!group) {
        return false;
    }

    // Check if we are already registered for this group
    if (member.existingMember) {
        const periodId = period.value.id;
        const existing = member.existingMember.filterRegistrations({ groups: [group], periodId });

        if (existing.length && isWaitingList.value) {
            return false;
        }

        if (existing.length && !isWaitingList.value && existing.find(e => !(e.group.type === GroupType.WaitingList))) {
            // already registered
            return false;
        }
    }

    return true;
}

interface RegistrationData {
    groupId: string;
    isWaitingList: boolean;
    pricePaid: number;
    registeredAt: Date | null;
    createdAt: Date;
    price: number;
}

const context = useContext();

const checkout = useCheckoutRegisterItem();
const owner = useRequestOwner();

async function getRegisterItem(member: PlatformMember, group: Group, organization: Organization, replaceRegistrations: RegistrationWithPlatformMember[]) {
    // const registerItem = getDefaultItem
    const item = await getDefaultItem({
        group,
        member,
        groupOrganization: organization,
        context: context.value,
        owner,
    });

    if (!item) {
        throw new Error('Failed to get default item');
    }

    item.replaceRegistrations = replaceRegistrations;
    return item;
}

// async function checkoutRegistration(member: PlatformMember, group: Group, organization: Organization, replaceRegistrations: RegistrationWithPlatformMember[]) {
//     // const registerItem = getDefaultItem
//     const item = await getDefaultItem({
//         group,
//         member,
//         groupOrganization: organization,
//         context: context.value,
//         owner,
//     });

//     if (item) {
//         item.replaceRegistrations = replaceRegistrations;

//         await checkout({
//             item,
//             startCheckoutFlow: true,
//         });
//     }
//     else {
//         console.error('Failed to get default item');
//     }
// }

function getGroupPrice(group: Group): GroupPrice {
    // todo: is admin?
    const prices = group.settings.getFilteredPrices({ admin: true });

    for (const price of prices) {
        const stock = price.getRemainingStock(group);
        if (stock !== 0) {
            return price;
        }
    }

    // Probably all sold out
    // Select the first one anyway
    return prices[0] ?? GroupPrice.create({ name: TranslatedString.create($t('83c99392-7efa-44d3-8531-1843c5fa7c4d')), id: '' });
}

// function createCheckout(member: PlatformMember, group: Group, organization: Organization) {
//     const registerItem = RegisterItem.defaultFor(member, group, organization);

//     // const groupPrice = getGroupPrice(group);

//     //     if (this.existingMember) {
//     //         const existingRegistration = this.existingMember.member.registrations.filter(r => r.isActive && r.groupId === group.id);
//     //         if (existingRegistration.length > 0) {
//     //             // update existing registrations for group
//     //             replaceRegistrationIds = [...replaceRegistrationIds, ...existingRegistration.map(r => r.id)];
//     //         }
//     //     }

//     return IDRegisterCheckout.create({
//         cart: IDRegisterCart.create({
//             items: [
//                 // IDRegisterItem.create({
//                 //     id: uuidv4(),
//                 //     replaceRegistrationIds,
//                 //     options: [],
//                 //     groupPrice,
//                 //     organizationId: this.organization.id,
//                 //     groupId: group.id,
//                 //     memberId: this.memberId,
//                 // }),
//             ],
//             balanceItems: [],
//             deleteRegistrationIds: [],
//         }),
//         // todo
//         administrationFee: 0,
//         // todo
//         freeContribution: 0,
//         // todo
//         paymentMethod: PaymentMethod.Unknown,
//         // todo
//         totalPrice: 25_00,
//         customer: null,
//     });
// }

function buildRegistration(member: ImportMemberResult): RegistrationData | null {
    if (!hasNewRegistration(member)) {
        return null;
    }

    const group = (member.registration.group ?? member.registration.autoAssignedGroup);

    if (!group) {
        return null;
    }

    const isReduced = member.patchedDetails.shouldApplyReducedPrice;
    let price = isWaitingList.value ? 0 : (member.registration.price === null ? getGroupPrice(group).price.getPrice(isReduced) : member.registration.price);

    let paidPrice = (member.registration.paid ?? paid.value ?? false) ? price : 0;

    if (member.registration.paidPrice !== null) {
        paidPrice = member.registration.paidPrice;
    }

    if (paidPrice && paidPrice > price) {
        price = paidPrice;
    }

    const registrationData: RegistrationData = {
        groupId: group.id,
        isWaitingList: isWaitingList.value,
        price,
        pricePaid: isWaitingList.value ? 0 : paidPrice,
        registeredAt: isWaitingList.value ? null : (member.registration.date ?? new Date()),
        createdAt: member.registration.date ?? new Date(),
    };

    return registrationData;
}

// todo
const period = ref(patched.value.period) as unknown as Ref<OrganizationRegistrationPeriod>;
const groups = computed(() => period.value.groups as Group[]) as ComputedRef<Group[]>;

function getOverrideRegistrations(registration: RegistrationData, member: ImportMemberResult): Registration[] {
    if (!member.existingMember) {
        return [];
    }

    let list: Registration[] = [];

    // TODO: delete more conflicting registrations (based on categories too!)
    const group = groups.value.find(g => g.id === registration.groupId);
    const periodId = period.value.id;

    if (group) {
        // if (registration.group.type !== GroupType.WaitingList) {
        //     // Delete from waiting list
        //     const existing = member.existingMember.filterRegistrations({ groups: [group], periodId, types: [GroupType.WaitingList] });
        //     for (const r of existing) {
        //         if (list.find(l => l.id === r.id)) {
        //             continue;
        //         }
        //         list.push(r);
        //     }
        // }

        // todo: is this correct?
        const parents = group.getParentCategories(period.value.availableCategories, false);

        for (const parent of parents) {
            const groupsInParent = parent.groupIds.map(id => groups.value.find(g => g.id === id)).filter(g => !!g) as Group[];

            if (parent.settings.maximumRegistrations === 1) {
                // Delete all registrations for these groups
                const existing = member.existingMember.filterRegistrations({ groups: groupsInParent, periodId });
                for (const r of existing) {
                    if (list.find(l => l.id === r.id)) {
                        continue;
                    }
                    list.push(r);
                }
            }
        }
    }
    return list;
}

async function goNext() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    // Show message
    const toast = new Toast('Bezig met importeren...', 'spinner').setHide(null).show();

    try {
        // Add all members that do not yet exist
        autoAssignMembers(props.members);

        // TODO: group family
        for (const member of props.members) {
            // todo
            // if (member.synced) {
            //     // Already synced: prevent doing it twice
            //     continue;
            // }
            // const family = new FamilyManager([]);

            // if (member.isEqual) {
            //     // Merge data (this is an edge case)
            //     member.equal.details!.merge(member.details);
            //     await family.patchAllMembersWith(member.equal);

            //     const patchRegistrations: PatchableArrayAutoEncoder<Registration> = new PatchableArray();
            //     const registration = buildRegistration(member);

            //     if (registration !== null) {
            //         // Okay to add: no duplicate
            //         patchRegistrations.addPut(registration);
            //         await family.patchMemberRegistrations(member.equal, patchRegistrations);

            //         // Delete conflicting registrations (based on categories too!)
            //         const deleteRegs = getOverrideRegistrations(registration, member);
            //         for (const r of deleteRegs) {
            //             patchRegistrations.addDelete(r.id);
            //         }
            //     }
            // }
            // else {
            //     const registration = buildRegistration(member);
            //     await family.addMember(member.details, registration ? [registration] : []);
            // }
            // member.synced = true;
        }

        toast.hide();
        new Toast('Importeren voltooid', 'success green').show();
        dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        toast.hide();
        console.error(e);
        Toast.fromError(e).show();
    }
    saving.value = false;
}
</script>
