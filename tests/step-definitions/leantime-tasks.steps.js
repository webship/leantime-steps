'use strict';

// The tasks of a project: a task made or removed for a scenario, the task list, a new task, and one task in its
// window (its status, its comments, its assignee, the time logged on it, who made it), and what an account that may
// not change a task cannot do.
//
// A task opens in a window of the page, which the steps find by the task's own address (its form sends to
// /tickets/showTicket/<number>), never by its order. What a step changes is read back from the site's own API.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly, smartSettle } = require('webship-js/tests/step-definitions/webship');
const h = require('./leantime-helpers');

/**
 * A task of this title is in the project, made for the scenario by the managing account when it is not there yet; a
 * task the step makes goes after the scenario. The project of cucumber.js when the step names none.
 *
 * Example #1: Given there is a task "Webship test site" in the project "Webship site"
 * Example #2: Given there is a task "Webship test a task"
 * Example #3: And there is a task "Webship test site" in the project "Webship site"
 * Example #4: And there is a task "Webship test a task"
 * Example #5: When there is a task "Webship test site" in the project "Webship site"
 */
Given(/^there is a task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  this.leantime = this.leantime || {};
  this.leantime.project = project.name;
  const found = await h.findTasks(this, project, title);
  if (!found.length) await h.makeTask(this, project, title);
});

/**
 * No task of this title is in the project: the managing account removes the ones there are.
 *
 * Example #1: Given there is no task "Webship test new" in the project "Webship site"
 * Example #2: Given there is no task "Webship test new"
 * Example #3: And there is no task "Webship test new" in the project "Webship site"
 * Example #4: And there is no task "Webship test new"
 * Example #5: When there is no task "Webship test new" in the project "Webship site"
 */
Given(/^there is no task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  this.leantime = this.leantime || {};
  this.leantime.project = project.name;
  for (const t of await h.findTasks(this, project, title)) await h.removeTask(this, t.id);
});

/**
 * The task list of the open project shows (or does not show) a task of this title.
 *
 * Example #1: Then the task list should show "The greeting script says Helo instead of Hello"
 * Example #2: Then the task list should not show "Webship test new"
 * Example #3: And the task list should show "The greeting script says Helo instead of Hello"
 * Example #4: But the task list should not show "Webship test new"
 * Example #5: Given the task list should show "The greeting script says Helo instead of Hello"
 */
Then(/^the task list should (not )?show "([^"]*)"$/, async function (notCase, title) {
  if (!/\/tickets\/show(All|Kanban)/.test(this.page.url())) await h.open(this, '/tickets/showAll');
  const link = this.page.locator('a[href*="/tickets/showTicket/"]', { hasText: h.exactly(title) });
  await h.assertPresence(link, notCase, { label: `the task "${title}" in the list`, hint: 'Open the project first: When I open the project "…". The list shows the project\'s tasks that are not done.', timeout: h.budget(this) });
});

/**
 * Make a task on the project's board, the way a person does: Add To-Do, its title, Enter. It goes after the scenario.
 *
 * Example #1: When I create a task "Webship test new" in the project "Webship site"
 * Example #2: When we create a task "Webship test new"
 * Example #3: And I create a task "Webship test new" in the project "Webship site"
 * Example #4: And we create a task "Webship test new"
 * Example #5: When we create a task "Webship test new" in the project "Webship site"
 */
When(/^(I |we )*create a task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (_who, title, projectName) {
  const project = await h.findProject(this, projectName || (this.leantime && this.leantime.project));
  this.leantime = this.leantime || {};
  this.leantime.project = project.name;
  await h.open(this, `/projects/changeCurrentProject/${project.id}`);
  await h.open(this, '/tickets/showKanban');
  await h.actOrExplain('make the task', title, async () => {
    await this.page.locator('a:visible', { hasText: /^\s*Add To-Do\s*$/ }).first().click();
    const field = this.page.locator('input.quickAddInput:visible').first();
    await field.waitFor({ state: 'visible', timeout: h.budget(this) });
    await field.fill(title);
    await field.press('Enter');
  }, 'The board offers "Add To-Do" to an Editor or above of the project; a Commenter and a Read Only person get none.');
  await smartSettle(this.page, 2000);
  const made = await h.waitForValue(() => h.findTasks(this, project, title), (list) => list.length > 0, h.budget(this));
  if (!made.ok) throw friendly({ message: `The task "${title}" was not made in ${project.name}.`, hint: 'The board makes a task when its title is entered in "Add To-Do".' });
  for (const t of made.value) h.remember(this, t.id);
});

/**
 * Open a task of the project by its title (or its number, as "#1"), in its window.
 *
 * Example #1: When I open the task "The greeting script says Helo instead of Hello"
 * Example #2: When we open the task "#1"
 * Example #3: And I open the task "The greeting script says Helo instead of Hello"
 * Example #4: And we open the task "#1"
 * Example #5: When we open the task "The greeting script says Helo instead of Hello"
 */
When(/^(I |we )*open the task "([^"]*)"$/, async function (_who, title) {
  const task = await h.taskNamed(this, title);
  await h.openTask(this, task);
});

/**
 * Set the open task's status, as its window offers it, and save the task.
 *
 * Example #1: When I set the status of the task to "In Progress"
 * Example #2: When we set the status of the task to "Done"
 * Example #3: And I set the status of the task to "In Progress"
 * Example #4: And we set the status of the task to "Done"
 * Example #5: When we set the status of the task to "In Progress"
 */
When(/^(I |we )*set the status of the task to "([^"]*)"$/, async function (_who, status) {
  await h.pickInTask(this, 'status', status);
  await h.saveTask(this);
});

/**
 * The open task's status, as the site has it now.
 *
 * Example #1: Then the status of the task should be "In Progress"
 * Example #2: Then the status of the task should be "New"
 * Example #3: And the status of the task should be "In Progress"
 * Example #4: But the status of the task should be "New"
 * Example #5: Given the status of the task should be "In Progress"
 */
Then(/^the status of the task should be "([^"]*)"$/, async function (status) {
  const task = await h.taskNow(this);
  const labels = await h.api(this, 'Tickets.Tickets.getStatusLabels', { projectId: Number(task.projectId) }, 'read the project\'s statuses');
  const read = async () => { const t = await h.taskNow(this); const l = labels[String(t.status)]; return l ? String(l.name) : String(t.status); };
  const result = await h.waitForValue(read, (name) => h.exactly(status).test(name), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task's status to be "${status}", but it is "${result.value}".`, hint: 'Name a status as the task\'s window shows it (New, In Progress, Done…).' });
});

/**
 * Add a comment to the open task, from its Discussion.
 *
 * Example #1: When I add the comment "Checked on the test site" to the task
 * Example #2: When we add the comment "A word on it" to the task
 * Example #3: And I add the comment "Checked on the test site" to the task
 * Example #4: And we add the comment "A word on it" to the task
 * Example #5: When we add the comment "Checked on the test site" to the task
 */
When(/^(I |we )*add the comment "([^"]*)" to the task$/, async function (_who, text) {
  const win = h.taskWindow(this);
  await h.actOrExplain('add the comment', text, async () => {
    await win.getByText('Add a new comment', { exact: true }).first().click();
    const editor = win.locator('.ProseMirror:visible').last();
    await editor.waitFor({ state: 'visible', timeout: h.budget(this) });
    await editor.click();
    await this.page.keyboard.type(text);
    await win.locator('input[type="submit"][name="comment"]:visible').last().click();
  }, 'A task\'s Discussion offers "Add a new comment" to a Commenter or above of the project; a Read Only person gets none.');
  await smartSettle(this.page, 2000);
});

/**
 * The open task shows a comment with this text, by this person (their whole name) when the step names one.
 *
 * Example #1: Then the task should show the comment "Checked on the test site" by "Member Test"
 * Example #2: Then the task should show the comment "Checked on the test site"
 * Example #3: And the task should show the comment "Checked on the test site" by "Member Test"
 * Example #4: But the task should show the comment "Checked on the test site"
 * Example #5: Given the task should show the comment "Checked on the test site" by "Member Test"
 */
Then(/^the task should show the comment "([^"]*)"(?: by "([^"]*)")?$/, async function (text, by) {
  const id = h.openTaskId(this);
  const read = async () => {
    const list = await h.api(this, 'Comments.Comments.getComments', { module: 'ticket', entityId: Number(id) }, `read the comments of #${id}`);
    return (Array.isArray(list) ? list : []).map((c) => ({ text: h.tidy(String(c.text || '').replace(/<[^>]*>/g, ' ')), by: h.tidy(`${c.firstname || ''} ${c.lastname || ''}`) }));
  };
  const result = await h.waitForValue(read, (list) => list.some((c) => c.text.includes(text) && (!by || h.exactly(by).test(c.by))), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task #${id} to show the comment "${text}"${by ? ` by ${by}` : ''}. Its comments: ${(result.value || []).map((c) => `"${c.text}" by ${c.by}`).join('; ') || 'none'}.`, hint: 'Name the comment\'s author by their whole name, as the site shows it.' });
  const shown = h.taskWindow(this).getByText(text).first();
  await h.assertPresence(shown, null, { label: `the comment "${text}" in the task's window`, hint: 'The comment is the site\'s, but its window does not show it: open the task again.', timeout: h.budget(this) }).catch(async () => {
    await h.openTask(this, await h.taskNamed(this, `#${id}`));
    await h.assertPresence(h.taskWindow(this).getByText(text).first(), null, { label: `the comment "${text}" in the task's window`, hint: 'The task\'s Discussion lists its comments.', timeout: h.budget(this) });
  });
});

/**
 * Assign the open task to someone of the project's team, by their whole name, and save the task.
 *
 * Example #1: When I assign the task to "Member Test"
 * Example #2: When we assign the task to "Owner Test"
 * Example #3: And I assign the task to "Member Test"
 * Example #4: And we assign the task to "Owner Test"
 * Example #5: When we assign the task to "Member Test"
 */
When(/^(I |we )*assign the task to "([^"]*)"$/, async function (_who, name) {
  await h.pickInTask(this, 'editorId', name);
  await h.saveTask(this);
});

/**
 * The open task's assignee, as the site has it now (their whole name).
 *
 * Example #1: Then the task should be assigned to "Member Test"
 * Example #2: Then the task should be assigned to "Owner Test"
 * Example #3: And the task should be assigned to "Member Test"
 * Example #4: But the task should be assigned to "Owner Test"
 * Example #5: Given the task should be assigned to "Member Test"
 */
Then(/^the task should be assigned to "([^"]*)"$/, async function (name) {
  const read = async () => { const t = await h.taskNow(this); return h.tidy(`${t.editorFirstname || ''} ${t.editorLastname || ''}`); };
  const result = await h.waitForValue(read, (who) => h.exactly(name).test(who), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task to be assigned to "${name}", but it is assigned to ${result.value || 'nobody'}.`, hint: 'Name the person by their whole name, as the site shows it.' });
});

/**
 * Log time on the open task, from its Time Tracking: the hours, and a note.
 *
 * Example #1: When I log "1.5" hours on the task with the note "Looked into it"
 * Example #2: When we log "2" hours on the task with the note "Fixed the greeting"
 * Example #3: And I log "1.5" hours on the task with the note "Looked into it"
 * Example #4: And we log "2" hours on the task with the note "Fixed the greeting"
 * Example #5: When we log "1.5" hours on the task with the note "Looked into it"
 */
When(/^(I |we )*log "([0-9]+(?:\.[0-9]+)?)" hours on the task with the note "([^"]*)"$/, async function (_who, hours, note) {
  const win = h.taskWindow(this);
  await h.actOrExplain('log time on the task', `${hours} h`, async () => {
    await win.locator('a[href="#timesheet"]').first().click();
    const form = win.locator('form[action*="#timesheet"]').first();
    await form.locator('input[name="hours"]').waitFor({ state: 'visible', timeout: h.budget(this) });
    await form.locator('input[name="hours"]').fill(hours);
    await form.locator('textarea[name="description"]').fill(note);
    await form.locator('input[type="submit"][name="saveTimes"]').click();
  }, 'A task\'s Time Tracking takes hours from an Editor or above of the project; a Commenter and a Read Only person have no such tab.');
  await smartSettle(this.page, 2000);
});

/**
 * The open task holds this much logged time in all, as the site counts it.
 *
 * Example #1: Then the task should have "1.5" hours logged
 * Example #2: Then the task should have "3" hours logged
 * Example #3: And the task should have "1.5" hours logged
 * Example #4: But the task should have "3" hours logged
 * Example #5: Given the task should have "1.5" hours logged
 */
Then(/^the task should have "([0-9]+(?:\.[0-9]+)?)" hours logged$/, async function (hours) {
  const id = h.openTaskId(this);
  const read = async () => Number(await h.api(this, 'Timesheets.Timesheets.getSumLoggedHoursForTicket', { ticketId: Number(id) }, `read the time logged on #${id}`)) || 0;
  const result = await h.waitForValue(read, (sum) => Math.abs(sum - Number(hours)) < 0.001, h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected ${hours} hours logged on the task #${id}, but it has ${result.value}.`, hint: 'The time of every person counts.' });
});

/**
 * The open task was made by this person, as its window says ("Created by …").
 *
 * Example #1: Then the task should be created by "Owner"
 * Example #2: Then the task should be created by "Member Test"
 * Example #3: And the task should be created by "Owner"
 * Example #4: But the task should be created by "Member Test"
 * Example #5: Given the task should be created by "Owner"
 */
Then(/^the task should be created by "([^"]*)"$/, async function (name) {
  const t = await h.taskNow(this);
  const full = h.tidy(`${t.userFirstname || ''} ${t.userLastname || ''}`);
  if (!(h.exactly(name).test(full) || h.exactly(name).test(String(t.userFirstname || '')))) throw friendly({ message: `Expected the task to be created by "${name}", but it was created by ${full || 'nobody'}.`, hint: 'Name the person by their first name or their whole name.' });
  const header = h.taskWindow(this).getByText(new RegExp(`Created by\\s+${h.escapeRegExp(String(t.userFirstname || name))}`, 'i')).first();
  await h.assertPresence(header, null, { label: `"Created by ${t.userFirstname}" in the task's window`, hint: 'The task\'s window says who made it under its title.', timeout: h.budget(this) });
});

/**
 * The browser's account may not change the open task: its Save buttons and its lists are disabled.
 *
 * Example #1: Then I should not be able to change the task
 * Example #2: Then we should not be able to change the task
 * Example #3: And I should not be able to change the task
 * Example #4: But we should not be able to change the task
 * Example #5: Given I should not be able to change the task
 */
Then(/^(I |we )*should not be able to change the task$/, async function (_who) {
  const win = h.taskWindow(this);
  const save = win.locator('input[name="saveTicket"]').first();
  await save.waitFor({ state: 'attached', timeout: h.budget(this) });
  const states = await win.evaluate((root) => ({
    save: [...root.querySelectorAll('input[name="saveTicket"], input[name="saveAndCloseTicket"]')].map((i) => i.disabled),
    assignee: [...root.querySelectorAll('select[name="editorId"]')].map((s) => s.disabled),
  }));
  if (!states.save.length || states.save.some((d) => !d) || states.assignee.some((d) => !d)) throw friendly({ message: 'Expected the task to be closed to this account, but its window lets it save the task.', hint: 'A Commenter and a Read Only person get the task\'s window with its Save buttons and lists disabled.' });
});

/**
 * The browser's account may not comment on the open task: its Discussion offers no new comment.
 *
 * Example #1: Then I should not be able to comment on the task
 * Example #2: Then we should not be able to comment on the task
 * Example #3: And I should not be able to comment on the task
 * Example #4: But we should not be able to comment on the task
 * Example #5: Given I should not be able to comment on the task
 */
Then(/^(I |we )*should not be able to comment on the task$/, async function (_who) {
  const win = h.taskWindow(this);
  await win.getByText('Discussion', { exact: true }).first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  const offered = await win.getByText('Add a new comment', { exact: true }).first().isVisible().catch(() => false);
  if (offered) throw friendly({ message: 'Expected no way to comment on the task, but its Discussion offers "Add a new comment".', hint: 'A Read Only person reads a task\'s comments and adds none; a Commenter may comment.' });
});

/**
 * The browser's account may not make a task in the project: its board offers no Add To-Do.
 *
 * Example #1: Then I should not be able to create a task in the project "Webship site"
 * Example #2: Then we should not be able to create a task in the project "Webship site"
 * Example #3: And I should not be able to create a task in the project "Webship site"
 * Example #4: But we should not be able to create a task in the project "Webship site"
 * Example #5: Given I should not be able to create a task in the project "Webship site"
 */
Then(/^(I |we )*should not be able to create a task in the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  await h.open(this, `/projects/changeCurrentProject/${project.id}`);
  await h.open(this, '/tickets/showKanban');
  const offered = await this.page.locator('a:visible', { hasText: /^\s*Add To-Do\s*$/ }).count();
  if (offered) throw friendly({ message: `Expected no way to make a task in ${project.name}, but its board offers "Add To-Do".`, hint: 'An Editor or above makes tasks; a Commenter and a Read Only person do not.' });
});

/**
 * The browser's account is refused a task: the site gives it no window and no data of it.
 *
 * Example #1: Then I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #2: Then we should be refused the task "#1"
 * Example #3: And I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #4: But we should be refused the task "#1"
 * Example #5: Then we should be refused the task "The greeting script says Helo instead of Hello"
 */
Then(/^(I |we )*should be refused the task "([^"]*)"$/, async function (_who, title) {
  const task = await h.taskNamed(this, title);
  const r = await h.rpcWith(this.context.request, h.siteRoot(this), 'Tickets.Tickets.getTicket', { id: Number(task.id) });
  if (r.result && typeof r.result === 'object') throw friendly({ message: `Expected the task #${task.id} to be refused, but the account reads it ("${r.result.headline}").`, hint: 'An account outside the project\'s team is refused its tasks.' });
  await h.open(this, `/tickets/showKanban#/tickets/showTicket/${task.id}`);
  const shown = await h.taskWindow(this, task.id).locator('input[name="headline"]').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (shown) throw friendly({ message: `Expected the task #${task.id} to be refused, but its window opened.`, hint: 'An account outside the project\'s team should get no window of its tasks.' });
});
