import { App } from "obsidian";
import { AppStateManager } from "../../core/AppStateManager";
import { BoardGroupingSelection } from "./BoardGroupingSelection";
import { TaskCreationHelper } from "../../utils/taskCreationHelper";

/**
 * Renders the timeline header for the board view, displaying time units (such as months or weeks) based on the current view mode. It sets up the grid headers for task alignment.
 *
 * Legacy files:
 * - "./src/components/YearView.ts"
 * - "./src/layouters/BoardLayouter.ts"
 * - 
 */

export function BoardTimelineHeader(boardLayout: any, appStateManager: AppStateManager, app: App, columnWidth?: number, isDebugMode = false): HTMLElement {
  const container = document.createElement("div");
  container.className = isDebugMode ? "debug-board-column-headers" : "board-column-headers";
  container.style.display = "grid";
  
  // Use provided columnWidth or default to 100px
  const width = columnWidth || 100;
  // Use fixed width columns to ensure consistent sizing
  container.style.gridTemplateColumns = `${width}px repeat(${boardLayout.columnHeaders.length}, ${width}px)`;
  container.style.gridAutoFlow = "row";
  container.style.gridAutoColumns = "unset";
  
  // Simple container styling
  container.style.minHeight = "40px";

  // Create the grouping selection dropdown for the first column (group header column)
  const groupingSelectionCell = BoardGroupingSelection(appStateManager);
  groupingSelectionCell.style.gridColumn = "1";
  groupingSelectionCell.style.gridRow = "1";
  if (isDebugMode) {
    groupingSelectionCell.classList.add("debug-cell");
  }
  container.appendChild(groupingSelectionCell);

  // Create task creation helper
  const taskCreationHelper = new TaskCreationHelper(app, appStateManager);

  // Modify header cells to start from grid column 2
  boardLayout.columnHeaders.forEach((header: any, index: number) => {
    const cellEl = document.createElement("div");
    cellEl.className = "board-cell timeline-header-cell clickable-header";
    cellEl.textContent = header.label;
    cellEl.style.gridColumnStart = (index + 2).toString();
    cellEl.style.gridRowStart = "1";
    
    // Simple header cell styling
    cellEl.style.textAlign = "center";
    cellEl.style.padding = "8px 4px";
    cellEl.style.fontSize = "12px";
    cellEl.style.cursor = "pointer";
    cellEl.style.position = "relative";
    
    // Add hover effect
    cellEl.addEventListener('mouseenter', () => {
      cellEl.style.backgroundColor = 'var(--interactive-hover)';
      cellEl.setAttribute('title', 'Click to create task for ' + header.label);
    });
    
    cellEl.addEventListener('mouseleave', () => {
      cellEl.style.backgroundColor = '';
      cellEl.removeAttribute('title');
    });
    
    // Add click handler for task creation
    cellEl.addEventListener('click', () => {
      taskCreationHelper.openTaskModalForDate(header.date);
    });
    
    if (isDebugMode) {
      cellEl.classList.add("debug-cell");
    }
    container.appendChild(cellEl);
  });
  return container;
}


