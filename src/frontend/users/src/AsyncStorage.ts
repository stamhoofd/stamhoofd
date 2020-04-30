import storage from 'electron-json-storage';

export class AsyncStorage {
    static async getItem(name: string): Promise<any> {
        return new Promise((resolve, reject) => {
            storage.getItem(name, (error, data) => {
                if (error) {
                    reject(error)
                    return;
                }
                resolve(data)
            });
        });
    }

    static async setItem(name: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            storage.setItem(name, data, (error: Error) => {
                if (error) {
                    reject(error)
                    return;
                }
                resolve()
            });
        });
    }
}