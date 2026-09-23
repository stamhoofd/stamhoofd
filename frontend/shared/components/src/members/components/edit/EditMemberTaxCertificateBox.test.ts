import type { AppType } from '@stamhoofd/structures';
import { NationalRegisterNumberOptOut, Parent, ParentType } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import { nextTick } from 'vue';
import Checkbox from '#inputs/Checkbox.vue';
import STListItem from '#layout/STListItem.vue';
import STErrorsDefault from '../../../errors/STErrorsDefault.vue';
import { Validator } from '../../../errors/Validator';
import Radio from '../../../inputs/Radio.vue';
import STInputBox from '../../../inputs/STInputBox.vue';
import type { TaxCertificateMemberOptions } from '../../testing/createTaxCertificateMember';
import { createTaxCertificateMember } from '../../testing/createTaxCertificateMember';
import EditMemberTaxCertificateBox from './EditMemberTaxCertificateBox.vue';

// Valid Belgian national register numbers: the last two digits are the checksum 97 - (rest % 97)
const VALID_NRN_A = '93.04.20-001.22';
const VALID_NRN_B = '93.04.20-002.21';
const MEMBER_NRN = '15.04.20-001.62';
const MEMBER_BIRTH_DAY = new Date(2015, 3, 20);

type TestOptions = TaxCertificateMemberOptions & {
    app?: AppType;
    hasFullAccess?: boolean;
};

function parent({ firstName, type, isMemberTaxDependent = null, nationalRegisterNumber = null }: { firstName: string; type?: ParentType; isMemberTaxDependent?: boolean | null; nationalRegisterNumber?: string | null }) {
    return Parent.create({
        firstName,
        lastName: 'Doe',
        type: type ?? ParentType.Other,
        isMemberTaxDependent,
        nationalRegisterNumber,
    });
}

function mother(options: { isMemberTaxDependent?: boolean | null; nationalRegisterNumber?: string | null } = {}) {
    return parent({ firstName: 'Moeder', type: ParentType.Mother, ...options });
}

function father(options: { isMemberTaxDependent?: boolean | null; nationalRegisterNumber?: string | null } = {}) {
    return parent({ firstName: 'Vader', type: ParentType.Father, ...options });
}

function renderBox(options: TestOptions = {}) {
    const { member, organization } = createTaxCertificateMember(options);
    organization.language = Language.Dutch;
    const validator = new Validator();

    render(EditMemberTaxCertificateBox, {
        props: {
            member,
            validator,
            // Forwarded to the title, which only renders (with the age toggle) inside a numbered section
            level: 1,
        },
        global: {
            components: {
                Radio,
                Checkbox,
                STErrorsDefault,
                STInputBox,
                STListItem,
            },
            provide: {
                $context: {
                    auth: {
                        canAccessPlatformMember: () => (options.app ?? 'dashboard') !== 'registration',
                        hasFullAccess: () => options.hasFullAccess ?? true,
                    },
                    organization,
                    user: null,
                },
                stamhoofd_app: options.app ?? 'dashboard',
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    formatDate: (date: Date) => date.toISOString(),
                } as any,
            },
            directives: {
                'format-input': {},
                'tooltip': {},
            },
        },
    });

    return { member, validator };
}

function severeDisabilityToggle() {
    return document.querySelector<HTMLButtonElement>('[data-testid="severe-disability-toggle"]');
}

function debtorRows() {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="debtor-row"]'));
}

function debtorRow(name: string) {
    const row = debtorRows().find(r => r.textContent?.includes(name));
    if (!row) {
        throw new Error(`No debtor row for ${name}`);
    }
    return row;
}

function radio(row: HTMLElement) {
    return row.querySelector<HTMLInputElement>('input[type="radio"]');
}

function checkbox(row: HTMLElement) {
    return row.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

function nrnInput(row: HTMLElement) {
    return row.querySelector<HTMLInputElement>('input[data-testid="debtor-nrn-input"]');
}

function coParentingCheckbox() {
    return document.querySelector<HTMLInputElement>('[data-testid="co-parenting-row"] input[type="checkbox"]');
}

function memberNrnInput() {
    return document.querySelector<HTMLInputElement>('[data-testid="member-nrn-input"] input');
}

async function click(element: HTMLElement | null) {
    if (!element) {
        throw new Error('Element not found');
    }
    element.click();
    await nextTick();
    await nextTick();
}

describe('severe disability toggle', () => {
    test('offered to full administrators of the dashboard', () => {
        renderBox({ parents: [mother()] });

        expect(severeDisabilityToggle()?.textContent).toContain('Tot 14 jaar');
    });

    test('shows the extended age once the member has a severe disability', () => {
        renderBox({ parents: [mother()], severeDisability: true });

        expect(severeDisabilityToggle()?.textContent).toContain('Tot 21 jaar');
    });

    test('a saved severe disability stays visible for a member that is too old for the toggle', () => {
        renderBox({ parents: [mother()], age: 25, severeDisability: true });

        expect(severeDisabilityToggle()?.textContent).toContain('Tot 21 jaar');
    });

    describe.each([
        ['the app is not an admin app', { app: 'registration' as const }],
        ['the user does not have full access', { hasFullAccess: false, severeDisability: true }],
        ['the member is older than 22', { age: 25 }],
    ] satisfies [string, TestOptions][])('hidden when %s', (_name, options) => {
        test('requirement is not met', () => {
            renderBox({ parents: [mother()], ...options });

            expect(severeDisabilityToggle()).toBeNull();
        });
    });
});

describe('choosing the debtor', () => {
    test('a single parent is the debtor without asking, when a member fills it in', async () => {
        const { member } = renderBox({ app: 'registration', parents: [mother()] });
        await nextTick();

        expect(member.patchedMember.details.parents[0].isMemberTaxDependent).toBe(true);

        const row = debtorRow('Moeder');
        expect(radio(row)).toBeNull();
        expect(checkbox(row)).toBeNull();
        expect(nrnInput(row)).not.toBeNull();
    });

    // Otherwise every member an administrator opens would get a pending change
    test('an administrator does not get a single parent chosen automatically', async () => {
        const { member } = renderBox({ parents: [mother()] });
        await nextTick();

        expect(member.patchedMember.details.parents[0].isMemberTaxDependent).toBeNull();
        expect(nrnInput(debtorRow('Moeder'))).toBeNull();
    });

    test('with two parents nobody is chosen until a radio is ticked', async () => {
        const { member } = renderBox({ parents: [mother(), father()] });
        await nextTick();

        expect(member.taxDependentParents).toHaveLength(0);
        expect(radio(debtorRow('Moeder'))).not.toBeNull();
        expect(radio(debtorRow('Vader'))).not.toBeNull();
        expect(nrnInput(debtorRow('Moeder'))).toBeNull();
        expect(nrnInput(debtorRow('Vader'))).toBeNull();
    });

    test('ticking a parent asks that parent\'s number, and moves along with the choice', async () => {
        const { member } = renderBox({ parents: [mother(), father()] });

        await click(radio(debtorRow('Moeder')));
        expect(member.patchedMember.details.parents.map(p => p.isMemberTaxDependent)).toEqual([true, false]);
        expect(nrnInput(debtorRow('Moeder'))).not.toBeNull();
        expect(nrnInput(debtorRow('Vader'))).toBeNull();

        await click(radio(debtorRow('Vader')));
        expect(member.patchedMember.details.parents.map(p => p.isMemberTaxDependent)).toEqual([false, true]);
        expect(nrnInput(debtorRow('Moeder'))).toBeNull();
        expect(nrnInput(debtorRow('Vader'))).not.toBeNull();
    });

    test('a stored choice is shown as ticked', async () => {
        renderBox({ parents: [mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }), father()] });
        await nextTick();

        expect(radio(debtorRow('Moeder'))?.checked).toBe(true);
        expect(radio(debtorRow('Vader'))?.checked).toBe(false);
        expect(nrnInput(debtorRow('Moeder'))?.value).toBe(VALID_NRN_A);
    });

    test('the co-parenting option is only offered with more than one parent', async () => {
        renderBox({ parents: [mother()] });
        await nextTick();
        expect(coParentingCheckbox()).toBeNull();

        document.body.innerHTML = '';
        renderBox({ parents: [mother(), father()] });
        await nextTick();
        expect(coParentingCheckbox()).not.toBeNull();
    });

    test('ticking co-parenting makes both parents debtor and asks both numbers', async () => {
        const { member } = renderBox({ parents: [mother(), father()] });

        await click(coParentingCheckbox());

        expect(member.patchedMember.details.parents.map(p => p.isMemberTaxDependent)).toEqual([true, true]);
        expect(nrnInput(debtorRow('Moeder'))).not.toBeNull();
        expect(nrnInput(debtorRow('Vader'))).not.toBeNull();

        // With exactly two parents there is nothing left to choose
        expect(checkbox(debtorRow('Moeder'))).toBeNull();
        expect(radio(debtorRow('Moeder'))).toBeNull();
    });

    test('two stored debtors show co-parenting as ticked, and unticking it keeps only the first', async () => {
        const { member } = renderBox({ parents: [mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }), father({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_B })] });
        await nextTick();

        expect(coParentingCheckbox()?.checked).toBe(true);

        await click(coParentingCheckbox());
        expect(member.patchedMember.details.parents.map(p => p.isMemberTaxDependent)).toEqual([true, false]);
        expect(radio(debtorRow('Moeder'))?.checked).toBe(true);
    });

    test('with three parents co-parenting offers a checkbox per parent', async () => {
        const { member } = renderBox({ parents: [mother(), father(), parent({ firstName: 'Plusouder' })] });

        await click(coParentingCheckbox());
        expect(member.taxDependentParents.map(p => p.firstName)).toEqual(['Moeder', 'Vader']);

        expect(checkbox(debtorRow('Plusouder'))).not.toBeNull();
        expect(checkbox(debtorRow('Plusouder'))?.checked).toBe(false);

        await click(checkbox(debtorRow('Vader')));
        await click(checkbox(debtorRow('Plusouder')));
        expect(member.taxDependentParents.map(p => p.firstName)).toEqual(['Moeder', 'Plusouder']);
    });

    test('the debtor question disappears after opting out of a national register number', async () => {
        renderBox({ parents: [mother(), father()], nationalRegisterNumber: NationalRegisterNumberOptOut });
        await nextTick();

        expect(memberNrnInput()?.disabled).toBe(true);
        expect(debtorRows()).toHaveLength(0);
        expect(coParentingCheckbox()).toBeNull();
    });
});

describe('validation', () => {
    test('a member has to choose a debtor', async () => {
        const { validator } = renderBox({ app: 'registration', parents: [mother(), father()] });
        await nextTick();

        await expect(validator.validate()).rejects.toThrow(/schuldenaar/);
    });

    test('an administrator can leave the debtor open', async () => {
        const { validator } = renderBox({ parents: [mother(), father()] });
        await nextTick();

        await expect(validator.validate()).resolves.toBe(true);
    });

    test('at most two debtors', async () => {
        const { validator } = renderBox({
            parents: [
                mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }),
                father({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_B }),
                parent({ firstName: 'Plusouder', isMemberTaxDependent: true, nationalRegisterNumber: '93.04.20-003.20' }),
            ],
        });
        await nextTick();

        await expect(validator.validate()).rejects.toThrow(/maximaal twee/);
    });

    test('co-parenting needs exactly two debtors', async () => {
        const { member, validator } = renderBox({ parents: [mother(), father(), parent({ firstName: 'Plusouder' })] });

        await click(coParentingCheckbox());
        await click(checkbox(debtorRow('Vader')));
        expect(member.taxDependentParents).toHaveLength(1);

        await expect(validator.validate()).rejects.toThrow(/twee schuldenaars/);
    });

    test('the debtor cannot reuse the number of the member', async () => {
        const { validator } = renderBox({
            nationalRegisterNumber: MEMBER_NRN,
            birthDay: MEMBER_BIRTH_DAY,
            parents: [mother({ isMemberTaxDependent: true, nationalRegisterNumber: MEMBER_NRN })],
        });
        await nextTick();

        await expect(validator.validate()).rejects.toThrow(/lid zelf/);
    });

    test('two debtors cannot share a number', async () => {
        const { validator } = renderBox({
            nationalRegisterNumber: MEMBER_NRN,
            birthDay: MEMBER_BIRTH_DAY,
            parents: [
                mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }),
                father({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }),
            ],
        });
        await nextTick();

        await expect(validator.validate()).rejects.toThrow(/andere ouder/);
    });

    test('valid data passes', async () => {
        const { validator } = renderBox({
            app: 'registration',
            nationalRegisterNumber: MEMBER_NRN,
            birthDay: MEMBER_BIRTH_DAY,
            parents: [
                mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_A }),
                father({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN_B }),
            ],
        });
        await nextTick();

        await expect(validator.validate()).resolves.toBe(true);
    });

    test('opting out clears the debtors instead of validating them', async () => {
        const { member, validator } = renderBox({
            app: 'registration',
            nationalRegisterNumber: NationalRegisterNumberOptOut,
            parents: [mother({ isMemberTaxDependent: true }), father({ isMemberTaxDependent: true }), parent({ firstName: 'Plusouder', isMemberTaxDependent: true })],
        });
        await nextTick();

        await expect(validator.validate()).resolves.toBe(true);
        expect(member.taxDependentParents).toHaveLength(0);
    });
});
