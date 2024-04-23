import { AsyncLocalStorage } from 'node:async_hooks';
import { QueueHandler } from './QueueHandler';

describe('QueueHandler', () => {
    it('Guards against deadlocks', async () => {
        const result = await QueueHandler.schedule('test', async () => {
            return QueueHandler.schedule('test', async () => {
                return 'test';
            });
        })

        expect(result).toBe('test');
    });

    it('Guards against deep deadlocks', async () => {
        const result = await QueueHandler.schedule('test', async () => {
            return QueueHandler.schedule('other', async () => {
                return QueueHandler.schedule('test', async () => {
                    return QueueHandler.schedule('other', async () => {
                        return QueueHandler.schedule('test', async () => {
                            return 'test';
                        });
                    });
                });
            });
        })

        expect(result).toBe('test');
    });

    it('Inherits the right AsyncLocalStorage context', async () => {
        const context = new AsyncLocalStorage<string>();

        const ranContexts: string[] = [];
        const promises: Promise<void>[] = [];

        // Do some quick scheduling
        for (let i = 0; i < 20; i++) {
            context.run(i.toString(), async () => {
                promises.push(QueueHandler.schedule('test', async () => {
                    await new Promise<void>(resolve => {
                        setTimeout(() => {
                            resolve();
                        }, 100);
                    });

                    ranContexts.push(context.getStore() ?? '');
                }));
            });
        }

        await Promise.allSettled(promises);

        expect(ranContexts).toHaveLength(20);
        expect(ranContexts.sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].sort());
    });

    it('Inherits the right AsyncLocalStorage context with parallel execution', async () => {
        const context = new AsyncLocalStorage<string>();

        const ranContexts: string[] = [];
        const promises: Promise<void>[] = [];

        // Do some quick scheduling
        for (let i = 0; i < 50; i++) {
            context.run(i.toString(), async () => {
                promises.push(QueueHandler.schedule('test', async () => {
                    await new Promise<void>(resolve => {
                        setTimeout(() => {
                            resolve();
                        }, 100);
                    });

                    ranContexts.push(context.getStore() ?? '');
                }, 5));
            });
        }

        await Promise.allSettled(promises);

        expect(ranContexts).toHaveLength(50);
        expect(ranContexts.sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'].sort());
    });
});