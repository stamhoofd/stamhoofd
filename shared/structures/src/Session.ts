export enum SessionClientType {
    Browser = 'Browser',
    iOS = 'iOS',
    Android = 'Android',
}

export enum SessionLoginMethod {
    Password = 'Password',
    Email = 'Email',
    SSO = 'SSO',
}

export enum SessionDeviceType {
    Phone = 'Phone',
    Tablet = 'Tablet',
    Desktop = 'Desktop',
}

export enum SessionOS {
    iOS = 'iOS',
    Android = 'Android',
    MacOS = 'MacOS',
    iPadOS = 'iPadOS',
    ChromeOS = 'ChromeOS',
    Windows = 'Windows',
    Linux = 'Linux',
}

export interface SessionMetaData {
    deviceType: SessionDeviceType;
    deviceName: string | null;
    osName: SessionOS | null;
    osVersion: string | null;
    appVersion: string | null;
    nativeAppVersion: string | null;
    browserName: string | null;
}
