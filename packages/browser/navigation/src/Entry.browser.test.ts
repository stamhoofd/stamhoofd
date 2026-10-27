import { expect, test } from 'vitest';

test('initializes the bundled navigation entry before a view is mounted', async () => {
    // eslint-disable-next-line stamhoofd/no-package-self-import
    const navigation = await import('@browser/navigation');

    expect(navigation.ComponentWithProperties).toBeTypeOf('function');
    expect(navigation.ComponentWithPropertiesInstance.props.component.type).toBe(navigation.ComponentWithProperties);
});
