import { updateProjects } from '../src/core/update/updateProjects';

function createFolder(name: string, children: any[] = []): any {
    return { name, children };
}

function createApp(taskDirectory: any): any {
    return {
        vault: {
            getAbstractFileByPath: jest.fn((path: string) => {
                if (path === 'Taskdown') return taskDirectory;
                return null;
            }),
        },
    };
}

describe('updateProjects', () => {
    it('preserves a missing selected project during normal refresh', async () => {
        const app = createApp(createFolder('Taskdown', [
            createFolder('Other Project'),
        ]));

        const result = await updateProjects(
            app,
            {},
            {
                currentProjectName: 'Saved Project',
                settings: { taskDirectory: 'Taskdown' } as any,
            }
        );

        expect(result.persistent.currentProjectName).toBe('Saved Project');
        expect(result.volatile.availableProjects).toEqual(['All Projects', 'Other Project']);
    });

    it('resets a missing selected project when requested', async () => {
        const app = createApp(createFolder('Taskdown', [
            createFolder('Other Project'),
        ]));

        const result = await updateProjects(
            app,
            {},
            {
                currentProjectName: 'Deleted Project',
                settings: { taskDirectory: 'Taskdown' } as any,
            },
            { resetMissingProject: true }
        );

        expect(result.persistent.currentProjectName).toBe('All Projects');
    });

    it('keeps a selected project that still exists when reset is requested', async () => {
        const app = createApp(createFolder('Taskdown', [
            createFolder('Existing Project'),
        ]));

        const result = await updateProjects(
            app,
            {},
            {
                currentProjectName: 'Existing Project',
                settings: { taskDirectory: 'Taskdown' } as any,
            },
            { resetMissingProject: true }
        );

        expect(result.persistent.currentProjectName).toBe('Existing Project');
    });
});
