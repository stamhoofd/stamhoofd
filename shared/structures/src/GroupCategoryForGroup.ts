export interface GroupCategoryForGroup<T> {
    id: string;
    groupIds: string[];
    settings: { public: boolean };
    getParentCategories(all: T[]): T[];
}
