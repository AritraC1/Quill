export interface BlogModel {
    id: string;
    userId: string;
    title: string;
    description: string;
    images?: string[];
    created_at: Date;
    updated_at: Date;
}