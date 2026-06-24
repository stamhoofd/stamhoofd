import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { DiscountCode, PrivateWebshop } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

// Hard cap on the number of discount codes a single webshop can have. Enforced in the frontend only (for now).
export const MAX_DISCOUNT_CODES = 1000;

// All characters except difficult to differentiate characters in uppercase (0, O, 1, L, I)
const codeAllowList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9'];

function randomChars(num = 4) {
    let result = '';
    for (let i = 0; i < num; i++) {
        result += codeAllowList[Math.floor(Math.random() * codeAllowList.length)];
    }
    return result;
}

function generateDiscountCode() {
    return randomChars(4) + '-' + randomChars(4) + '-' + randomChars(4) + '-' + randomChars(4);
}

/**
 * Actions for a single discount code (edit, duplicate, delete, delete all).
 *
 * The changes are passed to the `saveHandler` as a patchable array, so the caller decides when and how
 * to persist them (e.g. collecting multiple changes before saving them in one go).
 */
export function useDiscountCodeActions(saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => void) {
    const present = usePresent();

    return function getFor(props: {
        discountCode: DiscountCode;
        discountCodes: DiscountCode[];
        /**
         * The currently visible (filtered) discount codes. Equals `discountCodes` when no filter is active.
         */
        visibleDiscountCodes: DiscountCode[];
        /**
         * Whether a search query or advanced filter is currently narrowing the list.
         */
        isFiltering: boolean;
        webshop: PrivateWebshop;
    }) {
        // Clone the current discount code as a brand new code (new id, no usage), keeping all other settings.
        function buildClone(code: string): DiscountCode {
            const cloned = props.discountCode.clone();
            cloned.id = uuidv4();
            cloned.code = code;
            cloned.usageCount = 0;
            cloned.reserved = false;
            cloned.createdAt = new Date();
            cloned.updatedAt = new Date();
            return cloned;
        }

        function editDiscountCode() {
            present({
                components: [
                    AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                        isNew: false,
                        discountCode: props.discountCode,
                        webshop: props.webshop,
                        saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                            saveHandler(patch);
                        },
                    }),
                ],
                modalDisplayStyle: 'popup',
            }).catch(console.error);
        }

        // How many more discount codes can still be created before hitting the hard cap.
        function remainingCapacity() {
            return MAX_DISCOUNT_CODES - props.discountCodes.length;
        }

        // Duplicate once: open the edit view as if creating a new code, with all settings prefilled except the code itself.
        function duplicateOnce() {
            if (remainingCapacity() <= 0) {
                new Toast($t('Je kan maximaal {max} kortingscodes hebben.', { max: MAX_DISCOUNT_CODES }), 'error red').show();
                return;
            }

            const cloned = buildClone('');
            const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
            arr.addPut(cloned);

            present({
                components: [
                    AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                        isNew: true,
                        discountCode: cloned,
                        webshop: props.webshop,
                        saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                            arr.merge(patch);
                            saveHandler(arr);
                        },
                    }),
                ],
                modalDisplayStyle: 'popup',
            }).catch(console.error);
        }

        // Duplicate multiple times: generate random unique codes, no UI to edit them.
        function duplicateMultiple() {
            const remaining = remainingCapacity();
            if (remaining <= 0) {
                new Toast($t('Je kan maximaal {max} kortingscodes hebben.', { max: MAX_DISCOUNT_CODES }), 'error red').show();
                return;
            }

            present({
                components: [
                    AsyncComponent(() => import('./DuplicateDiscountCodesView.vue'), {
                        maxCount: remaining,
                        saveHandler: (count: number) => {
                            const usedCodes = new Set(props.discountCodes.map(c => c.code));
                            const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();

                            for (let i = 0; i < Math.min(count, remaining); i++) {
                                let code = generateDiscountCode();
                                while (usedCodes.has(code)) {
                                    code = generateDiscountCode();
                                }
                                usedCodes.add(code);
                                arr.addPut(buildClone(code));
                            }

                            saveHandler(arr);
                        },
                    }),
                ],
                modalDisplayStyle: 'sheet',
            }).catch(console.error);
        }

        // Copy this code's settings (description, max usage, discounts) to a selection of other codes.
        function copySettingsTo() {
            present({
                components: [
                    AsyncComponent(() => import('./CopyDiscountCodeSettingsView.vue'), {
                        discountCode: props.discountCode,
                        discountCodes: props.discountCodes,
                        saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                            saveHandler(patch);
                        },
                    }),
                ],
                modalDisplayStyle: 'popup',
            }).catch(console.error);
        }

        async function deleteDiscountCode() {
            if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze kortingscode wilt verwijderen?'), $t('Verwijderen'))) {
                return;
            }

            const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
            arr.addDelete(props.discountCode.id);
            saveHandler(arr);
        }

        async function deleteAllDiscountCodes() {
            // When a search or filter is active, only delete the currently visible codes.
            const codes = props.isFiltering ? props.visibleDiscountCodes : props.discountCodes;
            const confirmText = props.isFiltering
                ? $t('Ben je zeker dat je alle zichtbare kortingscodes wilt verwijderen?')
                : $t('Ben je zeker dat je alle kortingscodes wilt verwijderen?');

            if (!await CenteredMessage.confirm(confirmText, $t('Verwijderen'))) {
                return;
            }

            const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
            for (const code of codes) {
                arr.addDelete(code.id);
            }
            saveHandler(arr);
        }

        async function showMenu(event: MouseEvent) {
            const menu = new ContextMenu([
                [
                    new ContextMenuItem({
                        name: $t('Bewerken'),
                        icon: 'edit',
                        action: () => {
                            editDiscountCode();
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: $t('Dupliceren'),
                        icon: 'copy',
                        childMenu: new ContextMenu([
                            [
                                new ContextMenuItem({
                                    name: $t('Eén keer'),
                                    action: () => {
                                        duplicateOnce();
                                        return true;
                                    },
                                }),
                                new ContextMenuItem({
                                    name: $t('Meerdere keren'),
                                    action: () => {
                                        duplicateMultiple();
                                        return true;
                                    },
                                }),
                            ],
                        ]),
                    }),
                    new ContextMenuItem({
                        name: $t('Kopieer instellingen naar...'),
                        icon: 'sync',
                        disabled: props.discountCodes.length < 2,
                        action: () => {
                            copySettingsTo();
                            return true;
                        },
                    }),
                ],
                [
                    new ContextMenuItem({
                        name: $t('Kortingscode verwijderen'),
                        icon: 'trash',
                        destructive: true,
                        action: () => {
                            deleteDiscountCode().catch(console.error);
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: props.isFiltering ? $t('Alle zichtbare kortingscodes verwijderen') : $t('Alle kortingscodes verwijderen'),
                        icon: 'trash',
                        destructive: true,
                        action: () => {
                            deleteAllDiscountCodes().catch(console.error);
                            return true;
                        },
                    }),
                ],
            ]);

            if (event.type === 'contextmenu') {
                return await menu.show({ clickEvent: event });
            }

            await menu.show({ button: event.currentTarget as HTMLElement });
        }

        return { showMenu, editDiscountCode, duplicateOnce, duplicateMultiple, copySettingsTo, deleteDiscountCode, deleteAllDiscountCodes };
    };
}
