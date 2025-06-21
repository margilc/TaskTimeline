import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTaskFromContent, validateTaskFrontmatter } from '../src/core/utils/taskUtils';

const testDataPath = join(__dirname, 'data');

function readTestFile(filename: string): string {
    return readFileSync(join(testDataPath, filename), 'utf-8');
}

describe('parseTaskFromContent', () => {
    test('parses valid basic task', () => {
        const content = readTestFile('valid_task_basic.md');
        const task = parseTaskFromContent(content, 'test.md');
        
        expect(task.name).toBe('Basic Task');
        expect(task.start).toBe('2024-01-15');
        expect(task.end).toBe('');
        expect(task.category).toBe('default');
        expect(task.status).toBe('planned');
        expect(task.priority).toBe(5);
        expect(task.filePath).toBe('test.md');
        expect(task.totalSubtasks).toBe(0);
        expect(task.completedSubtasks).toBe(0);
    });

    test('parses valid complete task', () => {
        const content = readTestFile('valid_task_complete.md');
        const task = parseTaskFromContent(content, 'test.md');
        
        expect(task.name).toBe('Complete Task');
        expect(task.start).toBe('2024-01-15');
        expect(task.end).toBe('2024-01-20');
        expect(task.category).toBe('development');
        expect(task.status).toBe('in-progress');
        expect(task.priority).toBe(5);
    });

    test('parses task with subtasks', () => {
        const content = readTestFile('valid_task_subtasks.md');
        const task = parseTaskFromContent(content, 'test.md');
        
        expect(task.name).toBe('Task with Subtasks');
        expect(task.category).toBe('testing');
        expect(task.totalSubtasks).toBe(4);
        expect(task.completedSubtasks).toBe(2);
    });

    test('throws error for missing name', () => {
        const content = readTestFile('invalid_task_no_name.md');
        expect(() => parseTaskFromContent(content, 'test.md')).toThrow('Task must have a valid name field');
    });

    test('throws error for missing start', () => {
        const content = readTestFile('invalid_task_no_start.md');
        expect(() => parseTaskFromContent(content, 'test.md')).toThrow('Task must have a valid start date field');
    });

    test('throws error for bad date order', () => {
        const content = readTestFile('invalid_task_bad_dates.md');
        expect(() => parseTaskFromContent(content, 'test.md')).toThrow('Start date (2024-01-20) cannot be after end date (2024-01-15)');
    });
});

describe('validateTaskFrontmatter', () => {
    test('validates required fields', () => {
        expect(() => validateTaskFrontmatter({})).toThrow('Task must have a valid name field');
        expect(() => validateTaskFrontmatter({ name: 'Test' })).toThrow('Task must have a valid start date field');
    });

    test('validates date formats', () => {
        expect(() => validateTaskFrontmatter({ name: 'Test', start: 'invalid-date' })).toThrow('Start date must be in YYYY-MM-DD format');
        expect(() => validateTaskFrontmatter({ name: 'Test', start: '2024-01-15', end: 'invalid-date' })).toThrow('End date must be in YYYY-MM-DD format');
    });

    test('passes valid frontmatter', () => {
        expect(() => validateTaskFrontmatter({ name: 'Test', start: '2024-01-15' })).not.toThrow();
        expect(() => validateTaskFrontmatter({ name: 'Test', start: '2024-01-15', end: '2024-01-20' })).not.toThrow();
    });
});