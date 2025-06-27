# Layout Fix Roadmap

## Problem Analysis

Based on the debug dump, there are critical issues with the timeline layout system:

### 1. **Viewport Confusion**
- Two viewport concepts exist: `timelineViewport.localMinDate/localMaxDate` and `boardLayout.viewport.startDate/endDate`
- Column headers show May 2025 but `localMinDate` is May 31st instead of May 1st
- This creates misalignment between what users see and what the system calculates

### 2. **Task Visibility Issues**
- Task with date "2025-06-30" exists but `taskGrids` are empty
- Layout shows July column but no tasks are positioned there
- Task positioning logic fails to place tasks in visible columns

### 3. **Date Boundary Problems**
- Month column headers use incorrect dates (May shows as "2025-05-31" instead of "2025-05-01")
- This breaks task-to-column mapping logic
- Time unit boundaries not properly calculated

## Testing Analysis

### Current Test Gaps
1. **No Date Boundary Tests**: Tests don't verify that month columns start on month boundaries
2. **No Task Visibility Tests**: Tests don't verify that tasks with dates matching column ranges are actually positioned
3. **No Cross-Time-Unit Validation**: Tests don't ensure consistent behavior across DAY/WEEK/MONTH
4. **No Real Date Scenarios**: Tests use artificial datasets, missing edge cases with real dates

### Why Current Tests Miss These Issues
- Tests focus on structural correctness (column count, grid dimensions) but not date accuracy
- Mock data doesn't reflect real-world date edge cases
- No validation that visible date ranges actually contain tasks
- No verification that column headers represent correct date boundaries

## Roadmap

### Phase 1: Enhanced Test Suite
**Goal**: Create comprehensive tests that catch date boundary and task visibility issues

#### 1.1 Date Boundary Tests
- **Month Boundary Test**: Verify month columns start on 1st day of month, not last day
- **Week Boundary Test**: Verify week columns start on Monday, end on Sunday
- **Day Boundary Test**: Verify day columns represent single days correctly

#### 1.2 Task Visibility Tests
- **Task-Column Mapping Test**: Given task date, verify it appears in correct column
- **Cross-Time-Unit Task Test**: Same task should be visible in DAY/WEEK/MONTH views when viewport covers it
- **Edge Date Test**: Tasks on month/week boundaries should appear correctly

#### 1.3 Viewport Consistency Tests
- **Single Source of Truth**: Verify `timelineViewport` and `boardLayout.viewport` are consistent
- **Column Header Accuracy**: Verify column headers reflect actual date ranges used for task positioning
- **Task-Viewport Alignment**: Verify tasks within viewport date range are actually positioned

#### 1.4 Real-World Scenario Tests
- **Current Date Edge Cases**: Test with current date in middle, start, end of time periods
- **Multi-Month Spanning**: Test tasks that span multiple months in month view
- **Future/Past Date Scenarios**: Test with tasks far in future/past relative to current date

### Phase 2: Business Logic Fixes
**Goal**: Fix the underlying layout calculation logic

#### 2.1 Viewport Unification
- **Single Viewport Source**: Eliminate dual viewport concepts, use single authoritative source
- **Consistent Date Calculation**: Ensure viewport dates match column header dates exactly
- **Proper Boundary Calculation**: Fix month/week/day boundary calculations

#### 2.2 Column Header Fixes
- **Correct Month Headers**: Month columns should show first day of month, not last day of previous
- **Proper Week Headers**: Week columns should show Monday start date
- **Accurate Day Headers**: Day columns should show the actual day

#### 2.3 Task Positioning Logic
- **Accurate Date Matching**: Fix `isTaskInColumn` logic to properly match task dates to column ranges
- **Time Unit Consistency**: Ensure same logic works across DAY/WEEK/MONTH
- **Boundary Edge Cases**: Handle tasks on exact boundaries correctly

#### 2.4 Date Utility Improvements
- **Boundary Calculation Functions**: Create utilities for proper start/end of month/week/day
- **Consistent UTC Handling**: Ensure all date operations use consistent timezone handling
- **Time Unit Arithmetic**: Fix `addTime` function for proper month/week calculations

### Phase 3: Integration & Validation
**Goal**: Ensure fixes work together and maintain performance

#### 3.1 Integration Testing
- **End-to-End Scenarios**: Test complete user workflows (time unit changes, date navigation)
- **Performance Validation**: Ensure fixes don't degrade layout performance
- **Cache Consistency**: Verify layout cache works correctly with fixed logic

#### 3.2 Regression Prevention
- **Test Coverage Metrics**: Ensure all critical paths are covered by tests
- **Continuous Integration**: Add automated testing for date boundary scenarios
- **Documentation**: Document expected behavior for viewport and task positioning

## Implementation Priority

### High Priority (Immediate)
1. **Fix Column Header Dates**: Month columns must show correct start dates
2. **Fix Task Positioning**: Tasks in viewport date range must be positioned
3. **Unify Viewport Logic**: Single source of truth for date ranges

### Medium Priority (Next Sprint)
1. **Enhanced Test Suite**: Comprehensive date boundary and visibility tests
2. **Time Unit Consistency**: Ensure behavior is consistent across DAY/WEEK/MONTH
3. **Edge Case Handling**: Handle boundary conditions properly

### Low Priority (Future)
1. **Performance Optimization**: Optimize layout calculation performance
2. **Advanced Scenarios**: Handle complex multi-month, multi-year scenarios
3. **User Experience**: Improve visual feedback for date navigation

## Expected Outcomes

After implementing this roadmap:
- ✅ Month columns will start on 1st day of month (e.g., "2025-05-01" not "2025-05-31")
- ✅ Tasks with dates matching column ranges will be positioned correctly
- ✅ Single authoritative viewport eliminates confusion
- ✅ Comprehensive tests catch date boundary issues before they reach users
- ✅ Consistent behavior across all time units (DAY/WEEK/MONTH)
- ✅ Layout system is "waterproof" against date edge cases

## Risk Assessment

**High Risk**: 
- Changes to core layout logic could break existing functionality
- Date arithmetic is complex and error-prone

**Mitigation**:
- Implement comprehensive test suite BEFORE making business logic changes
- Make incremental changes with thorough testing at each step
- Maintain backward compatibility where possible

**Success Criteria**:
- All existing tests continue to pass
- New tests verify correct date boundaries and task positioning
- Debug dump shows tasks correctly positioned in columns matching their dates
- No empty taskGrids when tasks exist in visible date range