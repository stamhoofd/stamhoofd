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
            case UitpasClientCredentialsStatus.NotChecked: return $t('22487e0a-3bb0-4cb2-80c0-18fea6f3f016');
            case UitpasClientCredentialsStatus.NotConfigured: return $t('8b9c3203-aaea-4699-b274-2ac2eff7ec1d');
            case UitpasClientCredentialsStatus.NoPermissions: return $t('a24c0731-1c0f-46e2-8aaa-4569f6e0cc91');
            case UitpasClientCredentialsStatus.MissingPermissions: return $t('f3a5ff8c-f79e-474e-9e3e-5e85467f5770');
            case UitpasClientCredentialsStatus.Ok: return $t('c2e9194d-82b6-441a-ad47-bbac687667dd');
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
