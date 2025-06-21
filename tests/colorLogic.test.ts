import { PREDEFINED_COLORS, DEFAULT_COLOR, HIDE_COLOR, HIDE_VALUE } from '../src/core/utils/colorUtils';

// Extract the color logic for testing
function getTaskColor(task: any, state: any): string {
    const colorVariable = state.persistent.colorVariable;
    const currentProject = state.persistent.currentProjectName;
    
    // If no color variable selected or no project, return default
    if (!colorVariable || colorVariable === 'none' || !currentProject) {
        return DEFAULT_COLOR;
    }
    
    // Get the value from the task based on the color variable
    let taskValue: string | undefined;
    switch (colorVariable) {
        case 'category':
            taskValue = task.category;
            break;
        case 'status':
            taskValue = task.status;
            break;
        case 'priority':
            taskValue = task.priority?.toString();
            break;
        default:
            return DEFAULT_COLOR;
    }
    
    // If task doesn't have the value, return default
    if (!taskValue) {
        return DEFAULT_COLOR;
    }
    
    // Look up the color mapping
    const colorMappings = state.persistent.colorMappings;
    if (!colorMappings || !colorMappings[currentProject] || !colorMappings[currentProject][colorVariable]) {
        return DEFAULT_COLOR;
    }
    
    const color = colorMappings[currentProject][colorVariable][taskValue];
    if (!color) {
        return DEFAULT_COLOR;
    }
    
    // Handle hide value
    if (color === HIDE_VALUE) {
        return HIDE_COLOR;
    }
    
    return color;
}

describe('Color Logic Tests', () => {
    let baseTask: any;
    let baseState: any;

    beforeEach(() => {
        baseState = {
            persistent: {
                currentProjectName: 'TestProject',
                colorVariable: 'category',
                colorMappings: {
                    'TestProject': {
                        'category': {
                            'development': PREDEFINED_COLORS.BrightRed,
                            'testing': PREDEFINED_COLORS.OliveGreen,
                            'design': PREDEFINED_COLORS.Teal,
                            'hidden-category': HIDE_VALUE
                        },
                        'status': {
                            'In Progress': PREDEFINED_COLORS.BurntOrange,
                            'Done': PREDEFINED_COLORS.OliveGreen,
                            'Not Started': PREDEFINED_COLORS.SlateBlue
                        },
                        'priority': {
                            '1': PREDEFINED_COLORS.BrightRed,
                            '2': PREDEFINED_COLORS.Orange,
                            '3': PREDEFINED_COLORS.Mustard
                        }
                    }
                }
            }
        };

        baseTask = {
            name: 'Test Task',
            start: '2024-01-15',
            end: '2024-01-17',
            category: 'development',
            status: 'In Progress',
            priority: 1
        };
    });

    it('should return correct color based on category', () => {
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(PREDEFINED_COLORS.BrightRed);
    });

    it('should return correct color when color variable is status', () => {
        baseState.persistent.colorVariable = 'status';
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(PREDEFINED_COLORS.BurntOrange);
    });

    it('should return correct color when color variable is priority', () => {
        baseState.persistent.colorVariable = 'priority';
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(PREDEFINED_COLORS.BrightRed);
    });

    it('should return hide color when task value maps to hide', () => {
        const hiddenTask = { ...baseTask, category: 'hidden-category' };
        const color = getTaskColor(hiddenTask, baseState);
        expect(color).toBe(HIDE_COLOR);
    });

    it('should return default color when task has no category', () => {
        const taskWithoutCategory = { ...baseTask, category: undefined };
        const color = getTaskColor(taskWithoutCategory, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should return default color when category is not in mapping', () => {
        const taskWithUnmappedCategory = { ...baseTask, category: 'unmapped-category' };
        const color = getTaskColor(taskWithUnmappedCategory, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should return default color when color variable is none', () => {
        baseState.persistent.colorVariable = 'none';
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should return default color when no project is selected', () => {
        baseState.persistent.currentProjectName = undefined;
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should handle different task categories correctly', () => {
        // Test testing category
        const testingTask = { ...baseTask, category: 'testing' };
        const testingColor = getTaskColor(testingTask, baseState);
        expect(testingColor).toBe(PREDEFINED_COLORS.OliveGreen);

        // Test design category  
        const designTask = { ...baseTask, category: 'design' };
        const designColor = getTaskColor(designTask, baseState);
        expect(designColor).toBe(PREDEFINED_COLORS.Teal);
    });

    it('should handle priority as number correctly', () => {
        baseState.persistent.colorVariable = 'priority';
        
        // Test priority 2
        const priority2Task = { ...baseTask, priority: 2 };
        const priority2Color = getTaskColor(priority2Task, baseState);
        expect(priority2Color).toBe(PREDEFINED_COLORS.Orange);

        // Test priority 3
        const priority3Task = { ...baseTask, priority: 3 };
        const priority3Color = getTaskColor(priority3Task, baseState);
        expect(priority3Color).toBe(PREDEFINED_COLORS.Mustard);
    });

    it('should handle missing color mappings gracefully', () => {
        // Remove color mappings entirely
        delete baseState.persistent.colorMappings;
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should handle missing project color mappings', () => {
        // Remove current project from mappings
        delete baseState.persistent.colorMappings['TestProject'];
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });

    it('should handle missing variable color mappings', () => {
        // Remove category from project mappings
        delete baseState.persistent.colorMappings['TestProject']['category'];
        const color = getTaskColor(baseTask, baseState);
        expect(color).toBe(DEFAULT_COLOR);
    });
});