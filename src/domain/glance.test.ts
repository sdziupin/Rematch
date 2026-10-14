import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, weekWidgetProps, weekWidgetTimeline, type GlanceInput } from './glance';

// Wednesday 15 Oct 2025, 10:00 local; weeks start on Monday.
const NOW = new Date(2025, 9, 15, 10, 0, 0).getTime();
const at = (day: number, hour = 9) => new Date(2025, 9, day, hour).getTime();

const input = (timestamps: number[], weeklyGoal = 3): GlanceInput => ({
  timestamps,
  weeklyGoal,
  weekStartsOn: 1,
  last: timestamps.length ? { name: 'TEMPEST', score: '12:04', isPb: true, at: Math.max(...timestamps), color: '#FF0000' } : null,
});

test('widget props count this week and the last race', () => {
  const p = weekWidgetProps(input([at(6), at(13), at(15)]), NOW);
  assert.equal(p.count, 2);
  assert.equal(p.goal, 3);
  assert.equal(p.trainedToday, true);
  assert.equal(p.lastName, 'TEMPEST');
  assert.equal(p.lastWhen, 'Today');
  assert.equal(p.lastPb, true);
});

test('the widget timeline rolls the week over and ages the last race', () => {
  const entries = weekWidgetTimeline(input([at(13), at(15)]), NOW);
  assert.equal(entries.length, 8);
  assert.equal(entries[0].props.count, 2);
  assert.equal(entries[1].props.lastWhen, 'Yesterday');
  // Monday 20 Oct: a new week.
  const monday = entries.find((e) => e.date.getDate() === 20)!;
  assert.equal(monday.props.count, 0);
  assert.equal(monday.props.trainedToday, false);
});

test('reminders skip today once trained and stop when the goal is met', () => {
  const plan = planReminders({ ...input([at(13), at(15)]), hour: 18 }, NOW);
  // Trained today: first reminder is Thursday; then Friday... until the week is met (it isn't).
  assert.equal(new Date(plan[0].at).getDate(), 16);
  assert.equal(plan.length, 3);
  assert.match(plan[0].title, /One to go/);
  assert.match(plan[0].body, /TEMPEST/);

  const met = planReminders({ ...input([at(13), at(14), at(15)]), hour: 18 }, NOW);
  // Goal met: nothing until Monday's new week.
  assert.equal(new Date(met[0].at).getDate(), 20);
  assert.equal(met[0].title, 'New week, new race');
});

test('reminders today only when the hour is still ahead and nothing is logged', () => {
  const plan = planReminders({ ...input([]), hour: 18 }, NOW);
  assert.equal(new Date(plan[0].at).getDate(), 15);
  assert.equal(new Date(plan[0].at).getHours(), 18);
  assert.match(plan[0].body, /set the mark/);
  const late = planReminders({ ...input([]), hour: 8 }, NOW);
  assert.equal(new Date(late[0].at).getDate(), 16);
});
