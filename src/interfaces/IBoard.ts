import { ITaskGroup } from './ITaskGroup';

export interface IBoard {
    taskGroups: ITaskGroup[]; // Use ITaskGroup instead of any[]
    numberOfColumns: number;
    headers: string[];
}