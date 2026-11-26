'use strict';

// The sprints of a project: a sprint's tasks, on the project's task list filtered to it.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./leantime-helpers');

/**
 * Open a sprint of a project: the project's task list, of that sprint only.
 *
 * Example #1: When I open the sprint "Sprint 1" of the project "Webship site"
 * Example #2: When we open the sprint "Sprint 1" of the project "Webship site"
 * Example #3: And I open the sprint "Sprint 1" of the project "Webship site"
 * Example #4: And we open the sprint "Sprint 1" of the project "Webship site"
 * Example #5: Then I open the sprint "Sprint 1" of the project "Webship site"
 */
When(/^(I |we )*open the sprint "([^"]*)" of the project "([^"]*)"$/, async function (_who, sprintName, projectName) {
  const project = await h.findProject(this, projectName);
  const sprint = await h.findSprint(this, project, sprintName);
  this.leantime = this.leantime || {};
  this.leantime.project = project.name;
  this.leantime.sprint = sprint;
  await h.open(this, `/projects/changeCurrentProject/${project.id}`);
  await h.open(this, `/tickets/showAll?sprint=${sprint.id}`);
});

/**
 * The open sprint lists (or does not list) a task of this title.
 *
 * Example #1: Then the sprint should list the task "The greeting script says Helo instead of Hello"
 * Example #2: Then the sprint should not list the task "The usage line spells greeting as greting"
 * Example #3: And the sprint should list the task "The greeting script says Helo instead of Hello"
 * Example #4: But the sprint should not list the task "The usage line spells greeting as greting"
 * Example #5: Given the sprint should list the task "The greeting script says Helo instead of Hello"
 */
Then(/^the sprint should (not )?list the task "([^"]*)"$/, async function (notCase, title) {
  const sprint = this.leantime && this.leantime.sprint;
  if (!sprint) throw friendly({ message: 'No sprint is open.', hint: 'Open one first: When I open the sprint "…" of the project "…".' });
  const row = this.page.locator('table tbody tr', { has: this.page.locator('a[href*="/tickets/showTicket/"]', { hasText: h.exactly(title) }) });
  await h.assertPresence(row, notCase, { label: `the task "${title}" in the sprint ${sprint.name}`, hint: 'The sprint\'s list shows the tasks put in that sprint.', timeout: h.budget(this) });
});
