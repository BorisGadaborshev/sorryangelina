import { describe, expect, it } from 'vitest';
import {
  Card,
  RETRO_TEMPLATES,
  cloneTaskCardForNextSprint,
  getDiscussionCards,
  getRoadmapTaskColumn,
  selectOpenTasksFromPreviousSprints
} from '../src/types';

const taskColumn = (templateId: 'classic' | 'four-ls' = 'classic') =>
  getRoadmapTaskColumn(RETRO_TEMPLATES[templateId]);

const card = (overrides: Partial<Card> & Pick<Card, 'id' | 'column'>): Card => ({
  text: overrides.text ?? overrides.id,
  type: 'suggestion',
  createdBy: 'Ann',
  likes: [],
  dislikes: [],
  ...overrides
});

describe('selectOpenTasksFromPreviousSprints', () => {
  it('copies open task cards from the latest sprint and skips done or closed ones', () => {
    const column = taskColumn();
    const carried = selectOpenTasksFromPreviousSprints([
      {
        id: 'sprint-2',
        template: 'classic',
        cards: [
          card({ id: 'analysis', column, task: { assignees: ['Ann'], status: 'analysis' } }),
          card({ id: 'execution', column, task: { assignees: [], status: 'execution' } }),
          card({ id: 'testing', column, task: { assignees: [], status: 'testing' } }),
          card({ id: 'done', column, task: { assignees: [], status: 'done' } }),
          card({ id: 'closed', column, task: { assignees: [], status: 'closed' } }),
          card({ id: 'plain-task', column }),
          card({ id: 'not-a-task', column: 0 })
        ]
      }
    ]);

    expect(carried.map((item) => item.id)).toEqual([
      'analysis',
      'execution',
      'testing',
      'plain-task'
    ]);
  });

  it('walks back to an older sprint when the latest room has no task cards yet', () => {
    const column = taskColumn();
    const carried = selectOpenTasksFromPreviousSprints([
      { id: 'empty-retro', template: 'classic', cards: [card({ id: 'note', column: 1 })] },
      {
        id: 'older-sprint',
        template: 'classic',
        cards: [
          card({ id: 'open', column, task: { assignees: ['Ben'], status: 'execution' } }),
          card({ id: 'finished', column, task: { assignees: [], status: 'done' } })
        ]
      }
    ]);

    expect(carried.map((item) => item.id)).toEqual(['open']);
  });

  it('does not look further back after a sprint where every task is finished', () => {
    const column = taskColumn();
    const carried = selectOpenTasksFromPreviousSprints([
      {
        id: 'all-done',
        template: 'classic',
        cards: [card({ id: 'done', column, task: { assignees: [], status: 'done' } })]
      },
      {
        id: 'older-open',
        template: 'classic',
        cards: [card({ id: 'stale', column, task: { assignees: [], status: 'analysis' } })]
      }
    ]);

    expect(carried).toEqual([]);
  });
});

describe('getDiscussionCards', () => {
  it('keeps retro columns and drops task cards from discussion', () => {
    const column = taskColumn();
    const discussed = getDiscussionCards([
      card({ id: 'good', column: 0, likes: ['Ann'] }),
      card({ id: 'task', column, task: { assignees: [], status: 'execution' } }),
      card({ id: 'analysis', column: RETRO_TEMPLATES.classic.columns.length })
    ], RETRO_TEMPLATES.classic);

    expect(discussed.map((item) => item.id)).toEqual(['good']);
  });
});

describe('cloneTaskCardForNextSprint', () => {
  it('places the card into the next template task column and keeps the task fields', () => {
    const source = card({
      id: 'old',
      column: taskColumn('classic'),
      originColumn: 1,
      text: 'Медленные ревью',
      task: { assignees: ['Ann'], status: 'testing', sprint: '14', effortDays: 2.5 }
    });
    const cloned = cloneTaskCardForNextSprint(source, RETRO_TEMPLATES['four-ls'], 'new');

    expect(cloned.id).toBe('new');
    expect(cloned.column).toBe(taskColumn('four-ls'));
    expect(cloned.originColumn).toBe(1);
    expect(cloned.likes).toEqual([]);
    expect(cloned.task).toEqual({
      assignees: ['Ann'],
      status: 'testing',
      sprint: '14',
      effortDays: 2.5
    });
  });
});
