import { ITask } from './ITask';

export interface ITaskGroup {
    name: string;
    tasks: ITask[]; // Use ITask instead of any[]
}