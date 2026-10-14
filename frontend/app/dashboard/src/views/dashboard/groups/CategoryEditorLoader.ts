import type { Component } from 'vue';

export type CategoryEditorLoader = () => Promise<{ default: Component }>;
