export enum UitpasClientCredentialsStatus {
    NOT_CHECKED = 'NOT_CHECKED',
    NOT_CONFIGURED = 'NOT_CONFIGURED',
    NO_PERMISSIONS = 'NO_PERMISSIONS',
    MISSING_PERMISSIONS = 'MISSING_PERMISSIONS',
    OK = 'OK',
}

export class UitpasClientCredentialsStatusHelper {
    static getName(status: UitpasClientCredentialsStatus): string {
        switch (status) {
            case UitpasClientCredentialsStatus.NOT_CHECKED: return $t('Toegangsrechten nog niet gecontroleerd');
            case UitpasClientCredentialsStatus.NOT_CONFIGURED: return $t('Niet ingesteld');
            case UitpasClientCredentialsStatus.NO_PERMISSIONS: return $t('Jouw UiTPAS-integratie heeft geen toegansrechten tot de UiTPAS-organisator');
            case UitpasClientCredentialsStatus.MISSING_PERMISSIONS: return $t('Jouw UiTPAS-integratie heeft onvoldoende toegangsrechten');
            case UitpasClientCredentialsStatus.OK: return $t('Ingesteld en geldig');
        }
    }

    static getColor(status: UitpasClientCredentialsStatus) {
        switch (status) {
            case UitpasClientCredentialsStatus.NOT_CHECKED: return 'error red';
            case UitpasClientCredentialsStatus.NOT_CONFIGURED: return 'info';
            case UitpasClientCredentialsStatus.NO_PERMISSIONS: return 'warning';
            case UitpasClientCredentialsStatus.MISSING_PERMISSIONS: return 'warning';
            case UitpasClientCredentialsStatus.OK: return 'success';
        }
    }

    static getIcon(status: UitpasClientCredentialsStatus): string {
        switch (status) {
            case UitpasClientCredentialsStatus.NOT_CHECKED: return 'error red';
            case UitpasClientCredentialsStatus.NOT_CONFIGURED: return 'info gray';
            case UitpasClientCredentialsStatus.NO_PERMISSIONS: return 'warning yellow';
            case UitpasClientCredentialsStatus.MISSING_PERMISSIONS: return 'warning yellow';
            case UitpasClientCredentialsStatus.OK: return 'success green';
        }
    }
}
