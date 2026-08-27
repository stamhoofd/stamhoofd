import { useContext } from '#hooks/useContext.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { LanguageHelper, User } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { Toast } from '../../overlays/Toast';

export function useSwitchLanguage() {
    const context = useContext();

    /**
     * Stores the language on the signed-in user first, so it is restored on every device on the next page load.
     */
    async function saveUserLanguage(language: Language): Promise<boolean> {
        const session = context.value;
        const user = session?.user;
        if (!session || !user || !session.hasToken()) {
            return true;
        }

        try {
            await LoginHelper.patchUser(session, User.patch({ id: user.id, language }));
            return true;
        } catch (e) {
            Toast.fromError(e).show();
            return false;
        }
    }

    async function switchLanguage(event: MouseEvent) {
        const menu = new ContextMenu([
            I18nController.shared.availableLanguages.map((language) => {
                return new ContextMenuItem({
                    name: LanguageHelper.getNativeName(language),
                    selected: language === I18nController.shared.language,
                    action: async () => {
                        if (!await saveUserLanguage(language)) {
                            return;
                        }

                        await I18nController.shared.switchToLocale({
                            language,
                        });

                        // Reload full page
                        window.location.reload();
                    },
                });
            }),
        ]);

        await menu.show({
            clickEvent: event,
        });
    }

    return {
        switchLanguage,
        hasLanguages: I18nController.shared ? (I18nController.shared.availableLanguages.length > 1) : false,
    };
}
