import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { expect, test, vi } from 'vitest';
import type { ObjectFetcher } from './ObjectFetcher';
import type { TableActionSelection } from './TableAction';
import { InMemoryTableAction } from './TableAction';

type Item = { id: string };

test('an in-memory action passes the selection to its handler', async () => {
    const item = { id: 'marked' };
    const selection: TableActionSelection<Item> = {
        filter: new LimitedFilteredRequest({ limit: 100 }),
        fetcher: {} as ObjectFetcher<Item>,
        markedRows: new Map([[item.id, item]]),
        markedRowsAreSelected: true,
    };
    const handler = vi.fn();
    const action = new InMemoryTableAction<Item>({ name: 'Test', needsSelection: true, handler });

    await action.handle(selection);

    expect(handler).toHaveBeenCalledWith([item], false, selection);
});
