export type Service = {
    backend: 'redirecter' | 'api' | 'renderer' | 'backup';
} | {
    frontend: 'web-app' | 'dashboard' | 'registration' | 'webshop' | 'calculator';
};
