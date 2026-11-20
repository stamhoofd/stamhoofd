import { Group, GroupOption, GroupOptionMenu } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import Checkbox from '#inputs/Checkbox.vue';
import Radio from '#inputs/Radio.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import SaveView from '#navigation/SaveView.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import GroupOptionMenuView from './GroupOptionMenuView.vue';

function renderView(optionMenu: GroupOptionMenu, saveHandler: (patch: unknown) => Promise<void>) {
    return render(GroupOptionMenuView, {
        props: { optionMenu, group: Group.create({}), isNew: true, saveHandler },
        global: {
            components: { SaveView, STErrorsDefault, STInputBox, STList, STListItem, Checkbox, Radio, STNavigationBar, STToolbar, LoadingButton },
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_show: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    STAMHOOFD: (globalThis as any).STAMHOOFD,
                    $isMobile: false,
                    $isPhone: false,
                    $isIOS: false,
                    $isAndroid: false,
                    $context: null,
                    formatPrice: Formatter.price.bind(Formatter),
                    formatPriceChange: Formatter.priceChange.bind(Formatter),
                } as any,
            },
            directives: {
                tooltip: {},
                copyable: {},
                autofocus: {},
            },
        },
    });
}

test('refuses to save an option menu without options', async () => {
    const saveHandler = vi.fn().mockResolvedValue(undefined);
    const screen = renderView(GroupOptionMenu.create({ name: 'Maat', options: [] }), saveHandler);

    await screen.getByTestId('save-button').first().click();

    await expect.element(screen.getByText('heeft geen keuzes', { exact: false })).toBeVisible();
    expect(saveHandler).not.toHaveBeenCalled();
});

test('saves an option menu with options', async () => {
    const saveHandler = vi.fn().mockResolvedValue(undefined);
    const screen = renderView(GroupOptionMenu.create({ name: 'Maat', options: [GroupOption.create({ name: 'S' })] }), saveHandler);

    await screen.getByTestId('save-button').first().click();

    await vi.waitFor(() => expect(saveHandler).toHaveBeenCalledTimes(1));
});
