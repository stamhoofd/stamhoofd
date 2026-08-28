import type { AppType } from '@stamhoofd/structures';
import { Address, BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember, PropertyFilter } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import STErrorsDefault from '../../../errors/STErrorsDefault.vue';
import { Validator } from '../../../errors/Validator';
import Radio from '../../../inputs/Radio.vue';
import STInputBox from '../../../inputs/STInputBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import { Language } from '@stamhoofd/types/Language';
import Checkbox from '#inputs/Checkbox.vue';
import STListItem from '#layout/STListItem.vue';

type TestOptions = {
    app?: AppType;
    hasFullAccess?: boolean;
    isBelgium?: boolean;
    isNew?: boolean;
    isNationalRegisterNumberEnabled?: boolean;
    isOlderThan21?: boolean;
    severeDisability?: boolean;
};

function createMember(options: TestOptions) {
    const year = new Date().getFullYear();
    const platform = Platform.create({});
    platform.config.recordsConfiguration.nationalRegisterNumber = options.isNationalRegisterNumberEnabled === false
        ? null
        : new PropertyFilter(null, null);

    const family = new PlatformFamily({ platform });
    const member = new PlatformMember({
        family,
        isNew: options.isNew,
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                address: Address.create({
                    city: 'Brussel',
                    country: options.isBelgium === false ? Country.Netherlands : Country.Belgium,
                    number: '1',
                    postalCode: '1000',
                    street: 'Wetstraat',
                }),
                birthDay: options.isOlderThan21 ? new Date(year - 25, 0, 1) : new Date(year - 10, 0, 1),
                firstName: 'Jan',
                lastName: 'Peeters',
                severeDisability: BooleanStatus.create({ value: options.severeDisability ?? false }),
                nationalRegisterNumber: options.isNationalRegisterNumberEnabled === false ? null : '06.01.01-001.34',
            }),
        }),
    });
    family.add(member);

    return member;
}

function renderBox(options: TestOptions = {}) {
    const organization = Organization.create({});
    organization.language = Language.Dutch;

    if (options.isBelgium === false) {
        organization.address.country = Country.Netherlands;
    }

    return render(EditMemberGeneralBox, {
        props: {
            member: createMember(options),
            validator: new Validator(),
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
                        canAccessPlatformMember: () => true,
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
}

function severeDisabilityCheckbox(): HTMLInputElement | undefined {
    return document.querySelector<HTMLInputElement>('[data-testid="severe-disability-input"] input[type="checkbox"]') ?? undefined;
}

test('shows the severe disability checkbox to eligible full administrators', () => {
    renderBox();

    expect(severeDisabilityCheckbox()?.checked).toBe(false);
});

test('shows a saved severe disability value to full administrators regardless of the eligibility requirements', () => {
    renderBox({
        isBelgium: false,
        isOlderThan21: true,
        severeDisability: true,
    });

    expect(severeDisabilityCheckbox()?.checked).toBe(true);
});

describe.each([
    ['the member is new', { isNew: true }],
    ['the app is not an admin app', { app: 'registration' as const }],
    ['the user does not have full access', { hasFullAccess: false, severeDisability: true }],
    ['the member does not live in Belgium', { isBelgium: false }],
    ['the member is older than 21', { isOlderThan21: true }],
    ['the national register number is disabled', { isNationalRegisterNumberEnabled: false }],
] satisfies [string, TestOptions][])('hides the severe disability checkbox when %s', (_name, options) => {
    test('requirement is not met', () => {
        renderBox(options);

        expect(severeDisabilityCheckbox()).toBeUndefined();
    });
});
