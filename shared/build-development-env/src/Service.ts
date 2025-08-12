export type Service = {
    backend: 'redirecter' | 'api' | 'renderer' | 'backup';
} | {
    frontend: 'dashboard' | 'registration' | 'webshop' | 'calculator';
};
