import { inject } from 'vue';
import { WebshopManager } from '../classes/WebshopManager';

export function useWebshopManager(): WebshopManager {
    const webshopManager = inject<WebshopManager>('$webshopManager');
    if (!webshopManager) {
        console.error('No webshop manager provided.');
    }
    return webshopManager!;
}
