export enum UitpasClientCredentialsStatus {
    NotChecked = 'NotChecked',
    NotConfigured = 'NotConfigured',
    NoPermissions = 'NoPermissions',
    MissingPermissions = 'MissingPermissions',
    Ok = 'OK',
}

export class UitpasClientCredentialsStatusHelper {
    static getName(status: UitpasClientCredentialsStatus): string {
        switch (status) {
            case UitpasClientCredentialsStatus.NotChecked: return $t('Toegangsrechten van jouw UiTPAS-integratie is nog niet gecontroleerd');
            case UitpasClientCredentialsStatus.NotConfigured: return $t('Jouw UiTPAS-integratie is niet (meer) ingesteld');
            case UitpasClientCredentialsStatus.NoPermissions: return $t('Jouw UiTPAS-integratie heeft geen toegansrechten tot de UiTPAS-organisator');
            case UitpasClientCredentialsStatus.MissingPermissions: return $t('Jouw UiTPAS-integratie heeft onvoldoende toegangsrechten');
            case UitpasClientCredentialsStatus.Ok: return $t('Jouw UiTPAS-integratie is ingesteld en geldig');
        }
    }

    static getColor(status: UitpasClientCredentialsStatus) {
        switch (status) {
            case UitpasClientCredentialsStatus.NotChecked: return 'error red';
            case UitpasClientCredentialsStatus.NotConfigured: return 'info';
            case UitpasClientCredentialsStatus.NoPermissions: return 'warning';
            case UitpasClientCredentialsStatus.MissingPermissions: return 'warning';
            case UitpasClientCredentialsStatus.Ok: return 'success';
        }
    }

    static getIcon(status: UitpasClientCredentialsStatus): string {
        switch (status) {
            case UitpasClientCredentialsStatus.NotChecked: return 'error red';
            case UitpasClientCredentialsStatus.NotConfigured: return 'info gray';
            case UitpasClientCredentialsStatus.NoPermissions: return 'warning yellow';
            case UitpasClientCredentialsStatus.MissingPermissions: return 'warning yellow';
            case UitpasClientCredentialsStatus.Ok: return 'success green';
        }
    }
}
