import { getTaskColor } from '../src/components/BoardContainer/BoardTaskCard';
import { DEFAULT_COLOR } from '../src/core/utils/colorUtils';
import { makeTask } from './testHelpers';

function fakeStateManager(persistent: Record<string, unknown>) {
    return { getState: () => ({ persistent, volatile: {} }) } as any;
}

const task = makeTask({ name: 'T', start: '2026-01-10', category: 'work', priority: 2 });

describe('getTaskColor', () => {
    it('returns null (theme-driven) when nothing is customized', () => {
        const asm = fakeStateManager({ colorVariable: 'none', settings: { defaultCardColor: DEFAULT_COLOR } });
        expect(getTaskColor(task, asm)).toBeNull();
    });

    it('returns the customized default card color', () => {
        const asm = fakeStateManager({ colorVariable: 'none', settings: { defaultCardColor: '#4E6E8E' } });
        expect(getTaskColor(task, asm)).toBe('#4E6E8E');
    });

    it('returns the mapped color for the active color variable', () => {
        const asm = fakeStateManager({
            colorVariable: 'category',
            currentProjectName: 'P',
            settings: { defaultCardColor: DEFAULT_COLOR },
            colorMappings: { P: { category: { work: '#5A8A6A' } } },
        });
        expect(getTaskColor(task, asm)).toBe('#5A8A6A');
    });

    it('falls back to theme when the level is unmapped or hidden', () => {
        const asm = fakeStateManager({
            colorVariable: 'category',
            currentProjectName: 'P',
            settings: { defaultCardColor: DEFAULT_COLOR },
            colorMappings: { P: { category: { other: '#5A8A6A', work: 'hide' } } },
        });
        expect(getTaskColor(task, asm)).toBeNull();
    });

    it('mapping wins over a customized default', () => {
        const asm = fakeStateManager({
            colorVariable: 'priority',
            currentProjectName: 'P',
            settings: { defaultCardColor: '#4E6E8E' },
            colorMappings: { P: { priority: { '2': '#9E6A72' } } },
        });
        expect(getTaskColor(task, asm)).toBe('#9E6A72');
    });
});
