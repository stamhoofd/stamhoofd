<template>
    <div ref="root" class="container">
        <hr>
        <h2 class="style-with-button">
            <div @contextmenu.prevent="showContextMenu">
                {{ optionMenu.name || 'Naamloos' }}
                <span class="style-tag inline-first">{{ 'Keuzemenu' }}</span>
            </div>
            <div>
                <button class="button icon edit" type="button" @click="editOptionMenu" />
                <button class="button icon add" type="button" @click="addOption" />
            </div>
        </h2>

        <OptionMenuOptions :option-menu="optionMenu" @patch="addOptionMenuPatch" />
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, VersionBox } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, Toast, useIsMac } from '@stamhoofd/components';
import { Option, OptionMenu, Product, Version } from '@stamhoofd/structures';

import { ref, watch } from 'vue';
import EditOptionMenuView from './EditOptionMenuView.vue';
import EditOptionView from './EditOptionView.vue';
import OptionMenuOptions from './OptionMenuOptions.vue';

const props = defineProps<{
    optionMenu: OptionMenu;
    product: Product;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<Product>): void }>();

const isMac = useIsMac();
const present = usePresent();

const root = ref<HTMLElement | null>(null);

watch(root, (value) => {
    if (value) {
        value.addEventListener('copy', (event) => {
            try {
                (event as any).clipboardData.setData('text/plain', props.optionMenu.name || 'Naamloos');
                (event as any).clipboardData.setData('web stamhoofd/webshop-option-menu', JSON.stringify(new VersionBox(props.optionMenu).encode({ version: Version })));
                event.preventDefault();
            }
            catch (e) {
                console.error(e);
            }
        });
    }
});

function showContextMenu(event: MouseEvent) {
    const clipboardSupported = !!navigator.clipboard && !!window.ClipboardItem;
    const menu = new ContextMenu([
        [
            ...(clipboardSupported
                ? [new ContextMenuItem({
                        name: 'Kopiëren',
                        icon: 'copy',
                        action: () => {
                            const blob = new Blob([
                                JSON.stringify(new VersionBox(props.optionMenu).encode({ version: Version })),
                            ], { type: 'web stamhoofd/webshop-option-menu' });
                            navigator.clipboard.write(
                                [
                                    new ClipboardItem({
                                        ['web stamhoofd/webshop-option-menu']: blob,
                                    }),
                                ],
                            ).then(() => {
                                new Toast(isMac ? 'Keuzemenu gekopieërd. Gebruik CMD+V om dit keuzemenu ergens anders te plakken' : 'Keuzemenu gekopieërd. Gebruik CTRL+V om dit keuzemenu ergens anders te plakken', 'copy').show();
                            }).catch(console.error);
                            return true;
                        },
                    })]
                : []),
            new ContextMenuItem({
                name: 'Verwijderen',
                icon: 'trash',
                action: () => {
                    doDelete();
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

function addOption() {
    const option = Option.create({});
    const p = OptionMenu.patch({ id: props.optionMenu.id });
    p.options.addPut(option);

    present(new ComponentWithProperties(EditOptionView, { optionMenu: props.optionMenu.patch(p), option, isNew: true, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
        // Merge both patches
        const product = Product.patch({ id: props.product.id });
        product.optionMenus.addPatch(p.patch(patch));
        emits('patch', product);

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('sheet')).catch(console.error);
}

function editOptionMenu() {
    present(new ComponentWithProperties(EditOptionMenuView,
        {
            product: props.product,
            optionMenu: props.optionMenu,
            isNew: false,
            saveHandler: (patch: AutoEncoderPatchType<Product>) => {
                emits('patch', patch);
                // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
            } }).setDisplayStyle('popup')).catch(console.error);
}

function addOptionMenuPatch(patch: AutoEncoderPatchType<OptionMenu>) {
    const p = Product.patch({ id: props.product.id });
    p.optionMenus.addPatch(OptionMenu.patch(Object.assign({}, patch, { id: props.optionMenu.id })));
    addPatch(p);
}

function doDelete() {
    const p = Product.patch({ id: props.product.id });
    p.optionMenus.addDelete(props.optionMenu.id);
    addPatch(p);
}

function addPatch(patch: AutoEncoderPatchType<Product>) {
    emits('patch', patch);
}
</script>
