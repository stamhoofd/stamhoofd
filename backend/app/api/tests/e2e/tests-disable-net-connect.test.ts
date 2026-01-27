test('Should disallow net connect if request is not mocked', async () => {
    const promise = fetch('https://www.google.com');

    await expect(promise).rejects.toThrow(/Disallowed net connect/);
});
