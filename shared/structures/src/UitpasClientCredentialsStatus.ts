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
            case UitpasClientCredentialsStatus.NotChecked: return $t('%1Co');
            case UitpasClientCredentialsStatus.NotConfigured: return $t('%1Cp');
            case UitpasClientCredentialsStatus.NoPermissions: return $t('%1Cq');
            case UitpasClientCredentialsStatus.MissingPermissions: return $t('%1Cr');
            case UitpasClientCredentialsStatus.Ok: return $t('%1Cs');
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
