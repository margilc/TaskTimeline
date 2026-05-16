import { ITask } from '../src/interfaces/ITask';
import { resolveTaskLinks } from '../src/core/utils/linkUtils';

function createTask(id: string, name: string, linkedTaskIds?: string[]): ITask {
    return {
        id,
        name,
        start: '2024-01-01',
        end: '',
        category: 'default',
        status: 'planned',
        filePath: `${id}.md`,
        content: '',
        priority: 5,
        totalSubtasks: 0,
        completedSubtasks: 0,
        linkedTaskIds
    };
}

describe('resolveTaskLinks', () => {
    it('derives incoming links from resolved outgoing links', () => {
        const source = createTask('20240101_Source', 'Source', ['Target']);
        const target = createTask('20240102_Target', 'Target');

        resolveTaskLinks([source, target]);

        expect(source.linkedTaskIds).toEqual(['20240102_Target']);
        expect(source.linkedFromTaskIds).toBeUndefined();
        expect(target.linkedTaskIds).toBeUndefined();
        expect(target.linkedFromTaskIds).toEqual(['20240101_Source']);
    });

    it('deduplicates repeated links and excludes self-links', () => {
        const source = createTask('20240101_Source', 'Source', [
            'Target',
            '20240102_Target',
            'Source'
        ]);
        const target = createTask('20240102_Target', 'Target');

        resolveTaskLinks([source, target]);

        expect(source.linkedTaskIds).toEqual(['20240102_Target']);
        expect(source.linkedFromTaskIds).toBeUndefined();
        expect(target.linkedFromTaskIds).toEqual(['20240101_Source']);
    });

    it('supports mutual links without duplicating incoming IDs', () => {
        const first = createTask('20240101_First', 'First', ['Second']);
        const second = createTask('20240102_Second', 'Second', ['First', 'First']);

        resolveTaskLinks([first, second]);

        expect(first.linkedTaskIds).toEqual(['20240102_Second']);
        expect(first.linkedFromTaskIds).toEqual(['20240102_Second']);
        expect(second.linkedTaskIds).toEqual(['20240101_First']);
        expect(second.linkedFromTaskIds).toEqual(['20240101_First']);
    });

    it('clears stale incoming links on repeated resolution', () => {
        const source = createTask('20240101_Source', 'Source');
        const target = createTask('20240102_Target', 'Target');
        target.linkedFromTaskIds = ['stale-source'];

        resolveTaskLinks([source, target]);

        expect(source.linkedTaskIds).toBeUndefined();
        expect(source.linkedFromTaskIds).toBeUndefined();
        expect(target.linkedTaskIds).toBeUndefined();
        expect(target.linkedFromTaskIds).toBeUndefined();
    });
});
