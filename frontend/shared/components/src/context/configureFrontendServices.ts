import { UrlHelper } from '@browser/navigation';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { configureSessionPresentation } from '@stamhoofd/frontend-session/SessionPresentation';
import { configureApplicationPresentation } from '@stamhoofd/frontend-application/ApplicationPresentation';
import { configureNetworking } from '@stamhoofd/networking/NetworkingConfiguration';
import { Version } from '@stamhoofd/structures';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ColorHelper } from '../ColorHelper';

/** Install concrete frontend service adapters before requests or authentication flows start. */
export function configureFrontendServices() {
    configureApplicationPresentation({
        setPrimaryColor: color => { ColorHelper.setColor(color); },
    });
    configureSessionPresentation({
        confirm: options => CenteredMessage.confirm(options),
    });
    configureNetworking({
        async getRequestHeaders() {
            const headers: Record<string, string> = {
                'X-Platform': AppManager.shared.platform,
                'X-Session-Metadata': encodeURIComponent(JSON.stringify(await AppManager.shared.getSessionMetaData())),
            };
            if (I18nController.shared) {
                headers['X-Locale'] = I18nController.shared.locale;
            }
            return headers;
        },
        onClientUpdateRequired(error) {
            Toast.fromError(error).show();
            if (!AppManager.shared.isNative && !UrlHelper.initial.getSearchParams().has('forceClientUpdate')) {
                const url = new URL(window.location.href);
                url.searchParams.set('forceClientUpdate', new Date().getTime() + '');
                window.location.href = url.toString();
            }
            else {
                AppManager.shared.checkUpdates({
                    visibleCheck: 'text',
                    visibleDownload: true,
                    installAutomatically: true,
                }).catch(console.error);
            }
        },
        onNewerVersion(latestVersion) {
            if (AppManager.shared.isNative) {
                new Toast($t(`%kt`), 'yellow download').setHide(null).show();
                AppManager.shared.checkUpdates({ checkTimeout: 20 * 1000 }).catch(console.error);
            }
            else {
                console.info('Received latest version: ', latestVersion, 'got', Version);
                new Toast($t(`%ku`), 'yellow download').setHide(null).show();
            }
        },
    });
}
