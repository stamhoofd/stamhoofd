import { SessionContext } from '@stamhoofd/networking/SessionContext.ts';
import { Group, GroupSettings, MemberDetails, MembersBlob, MemberWithRegistrationsBlob, Organization, OrganizationRegistrationPeriod, Platform, PlatformFamily, RegisterItem, RegistrationPeriod, TranslatedString } from '@stamhoofd/structures';
import { PlatformFamilyHelper } from '@stamhoofd/structures/helpers/PlatformFamilyHelper.js';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { reactive, shallowRef, toRaw } from 'vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import ChooseOrganizationMembersForGroupView from '#members/ChooseOrganizationMembersForGroupView.vue';
import RegisterItemCheckboxRow from '#members/components/group/RegisterItemCheckboxRow.vue';
import RegisterItemRow from '#members/components/group/RegisterItemRow.vue';
import type { useAddMember } from '#members/hooks/useAddMember.ts';
import type { useEditMember } from '#members/hooks/useEditMember.ts';
import SaveView from '#navigation/SaveView.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import type { RegisterItemCheckoutHandler } from './CheckoutSelectionHandlers.ts';

const { addMember, editMember } = vi.hoisted(() => ({
    addMember: vi.fn<ReturnType<typeof useAddMember>>(),
    editMember: vi.fn<ReturnType<typeof useEditMember>>(),
}));

vi.mock('#members/hooks/useAddMember.ts', () => ({ useAddMember: () => addMember }));
vi.mock('#members/hooks/useEditMember.ts', () => ({ useEditMember: () => editMember }));

afterEach(() => vi.resetAllMocks());

function createNavigation(): NavigationActions {
    return {
        show: vi.fn<NavigationActions['show']>().mockResolvedValue(undefined),
        present: vi.fn<NavigationActions['present']>().mockResolvedValue(undefined),
        dismiss: vi.fn<NavigationActions['dismiss']>().mockResolvedValue(undefined),
        pop: vi.fn<NavigationActions['pop']>().mockResolvedValue(undefined),
    };
}

function createSelection(app = 'registration') {
    const platform = Platform.create({});
    const period = RegistrationPeriod.create({});
    const organization = Organization.create({ period: OrganizationRegistrationPeriod.create({ period }) });
    const group = Group.create({
        organizationId: organization.id,
        periodId: period.id,
        settings: GroupSettings.create({ description: new TranslatedString('Registration details') }),
    });
    const family = reactive(PlatformFamilyHelper.fromBlob(MembersBlob.create({
        members: [MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ firstName: 'Jan', lastName: 'Peeters' }),
        })],
    }), { platform, contextOrganization: organization })) as PlatformFamily;
    const checkout = PlatformFamilyHelper.getCheckout(family);
    const member = family.members[0];
    const context = new SessionContext(organization, platform);
    const navigation = createNavigation();
    const checkoutRegisterItemHandler = vi.fn<RegisterItemCheckoutHandler>().mockResolvedValue(undefined);
    const global = {
        renderStubDefaultSlot: true,
        components: { STList, STListItem, SaveView },
        stubs: { Checkbox: true },
        mocks: { $t },
        provide: {
            $context: context,
            stamhoofd_app: app,
            reactive_navigation_show: navigation.show,
            reactive_navigation_present: navigation.present,
            reactive_navigationController: shallowRef(null),
        },
    };
    return { organization, group, family, checkout, member, context, navigation, checkoutRegisterItemHandler, global };
}

test.each([
    ['registration', false],
    ['dashboard', true],
    ['admin', true],
])('editing a cart row in %s passes its local context and navigation to checkout', async (app, admin) => {
    const selection = createSelection(app);
    const { member, group, organization, context, navigation, checkoutRegisterItemHandler, global } = selection;
    const item = RegisterItem.defaultFor(member, group, organization);
    const wrapper = shallowMount(RegisterItemRow, { props: { item, checkoutRegisterItemHandler }, global });

    expect(wrapper.findComponent(STListItem).props('selectable')).toBe(true);
    await wrapper.findComponent(STListItem).trigger('click');
    await flushPromises();

    expect(checkoutRegisterItemHandler).toHaveBeenCalledOnce();
    const options = checkoutRegisterItemHandler.mock.calls[0][0];
    expect(toRaw(options.item)).toBe(item);
    expect(options.context).toBe(context);
    expect(options).toMatchObject({ admin, startCheckoutFlow: false, displayOptions: { action: 'present', modalDisplayStyle: 'popup' } });
    await options.navigate.show({ components: [] });
    await options.navigate.present({ components: [] });
    expect(navigation.show).toHaveBeenCalledOnce();
    expect(navigation.present).toHaveBeenCalledOnce();
    wrapper.unmount();
});

test('selecting a member invokes checkout and deselecting removes the item without invoking checkout again', async () => {
    const { member, group, organization, checkout, context, navigation, checkoutRegisterItemHandler, global } = createSelection();
    const wrapper = shallowMount(RegisterItemCheckboxRow, {
        props: { member, group, groupOrganization: organization, checkout, checkoutRegisterItemHandler },
        global,
    });

    await wrapper.findComponent(STListItem).trigger('click');
    await flushPromises();

    expect(checkoutRegisterItemHandler).toHaveBeenCalledOnce();
    const options = checkoutRegisterItemHandler.mock.calls[0][0];
    expect(toRaw(options.item.member)).toBe(toRaw(member));
    expect(toRaw(options.item.group)).toBe(group);
    expect(toRaw(options.item.organization)).toBe(organization);
    expect(options.context).toBe(context);
    expect(options).toMatchObject({ admin: false, startCheckoutFlow: false, displayOptions: { action: 'present', modalDisplayStyle: 'popup' } });
    await options.navigate.present({ components: [] });
    expect(navigation.present).toHaveBeenCalledOnce();

    checkout.add(options.item);
    await wrapper.findComponent(STListItem).trigger('click');
    await flushPromises();

    expect(checkout.cart.getMemberAndGroup(member.id, group.id)).toBeNull();
    expect(checkoutRegisterItemHandler).toHaveBeenCalledOnce();
    wrapper.unmount();
});

test('adding a member uses the loaded group organization and the edit continuation navigation without clearing the shared cart', async () => {
    const { member, group, organization, checkout, context, navigation, checkoutRegisterItemHandler, global } = createSelection('dashboard');
    const existingItem = RegisterItem.defaultFor(member, group, organization);
    checkout.add(existingItem);
    const addNavigation = createNavigation();
    const editNavigation = createNavigation();
    const wrapper = shallowMount(ChooseOrganizationMembersForGroupView, {
        props: { group, groupOrganization: organization, checkout, checkoutRegisterItemHandler },
        global,
    });

    await wrapper.find('button:has(.icon.add)').trigger('click');
    expect(addMember).toHaveBeenCalledOnce();
    const [newFamily, addOptions] = addMember.mock.calls[0];
    expect(toRaw(newFamily.checkout)).toBe(toRaw(checkout));
    const newMember = newFamily.newMember();
    await addOptions.finishHandler(newMember, addNavigation);

    expect(editMember).toHaveBeenCalledOnce();
    const [editedMember, editOptions] = editMember.mock.calls[0];
    expect(toRaw(editedMember)).toBe(toRaw(newMember));
    expect(editOptions.navigate).toBe(addNavigation);
    const item = newMember.family.pendingRegisterItems[0];
    expect(toRaw(item.group)).toBe(group);
    expect(toRaw(item.organization)).toBe(organization);
    expect(checkoutRegisterItemHandler).not.toHaveBeenCalled();

    await editOptions.finishHandler!(editNavigation);
    expect(checkoutRegisterItemHandler).toHaveBeenCalledOnce();
    const options = checkoutRegisterItemHandler.mock.calls[0][0];
    expect(toRaw(options.item)).toBe(toRaw(item));
    expect(toRaw(options.item.checkout)).toBe(toRaw(checkout));
    expect(options.context).toBe(context);
    expect(options.navigate).toBe(editNavigation);
    expect(options).toMatchObject({ admin: true, startCheckoutFlow: false, displayOptions: { action: 'show' } });
    expect(checkout.cart.contains(existingItem)).toBe(true);
    expect(navigation.show).not.toHaveBeenCalled();
    expect(navigation.present).not.toHaveBeenCalled();
    wrapper.unmount();
});
