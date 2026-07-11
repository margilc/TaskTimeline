import { CustomDropdown } from '../src/components/common/CustomDropdown';

function dropdownWithoutDom(): {
    dropdown: CustomDropdown;
    add: jest.Mock;
    remove: jest.Mock;
} {
    const add = jest.fn();
    const remove = jest.fn();
    const dropdown = Object.create(CustomDropdown.prototype) as CustomDropdown;

    Object.assign(dropdown as unknown as Record<string, unknown>, {
        isOpen: false,
        menuEl: { classList: { add, remove } },
    });

    return { dropdown, add, remove };
}

describe('CustomDropdown open state', () => {
    it('closes the active menu before opening another one', () => {
        const first = dropdownWithoutDom();
        const second = dropdownWithoutDom();

        (first.dropdown as any).open();
        (second.dropdown as any).open();

        expect(first.remove).toHaveBeenCalledWith('is-open');
        expect((first.dropdown as any).isOpen).toBe(false);
        expect(second.add).toHaveBeenCalledWith('is-open');
        expect((second.dropdown as any).isOpen).toBe(true);

        (second.dropdown as any).close();
    });
});
