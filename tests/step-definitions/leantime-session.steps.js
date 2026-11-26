'use strict';

// Logging in and out, the session's account, and who may open a project.
//
// The site logs in with an e-mail address and a password on one form (/auth/login), and out at /auth/logout. The
// session's account is read from the site's own API, so a step never guesses it from the page. A project is opened by
// its name; an account that is not in its team is refused it.

const { Given, When, Then, After, AfterAll } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./leantime-helpers');

/**
 * Log in as an account of the users registry (cucumber.js, worldParameters.users), or keep its session when it is the
 * browser's already.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "owner" user
 * Example #3: And I am a logged in user with the "member" user
 * Example #4: And we are a logged in user with the "owner" user
 * Example #5: Given we are a logged in user with the "member" user
 */
Given(/^(I am|we are) a logged in user with the "([^"]*)" user$/, async function (_who, handle) {
  await h.signInAs(this, handle);
});

/**
 * Log in through the form as an account of the users registry: a new session, whatever the browser held.
 *
 * Example #1: When I log in with the "member" user
 * Example #2: When log in with the "reader" user
 * Example #3: And I log in with the "member" user
 * Example #4: And log in with the "reader" user
 * Example #5: When we log in with the "member" user
 */
When(/^(I |we )*log in with the "([^"]*)" user$/, async function (_who, handle) {
  const user = h.resolveUser(this, handle);
  await h.dropSession(this);
  await h.submitLogin(this, user.username, user.password);
  const same = (email) => String(email).toLowerCase() === String(user.username).toLowerCase();
  const result = await h.waitForValue(() => h.currentUser(this), same, h.budget(this));
  if (!result.ok) throw friendly({ message: `Logging in as "${handle}" (${user.username}) did not work; the page is ${this.page.url()}.`, hint: 'Check the account\'s e-mail address and password in worldParameters.users of cucumber.js.' });
  await h.closeTour(this);
});

/**
 * Log in through the form with an e-mail address and a password that need not be right: the step asserts nothing, a
 * refusal is read by the steps after it.
 *
 * Example #1: When I log in as "member@example.com" with the password "not-the-right-password"
 * Example #2: When log in as "nobody@example.com" with the password "dD.123123ddd"
 * Example #3: And I log in as "member@example.com" with the password "not-the-right-password"
 * Example #4: And log in as "nobody@example.com" with the password "dD.123123ddd"
 * Example #5: When we log in as "member@example.com" with the password "not-the-right-password"
 */
When(/^(I |we )*log in as "([^"]*)" with the password "([^"]*)"$/, async function (_who, email, password) {
  await h.dropSession(this);
  await h.submitLogin(this, email, password);
});

/**
 * Start without a session: the browser holds none of the site's.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: And we are not logged in
 * Example #5: When I am not logged in
 */
Given(/^(I am|we are) not logged in$/, async function (_who) {
  await h.dropSession(this);
});

/**
 * Log out, the way the site does it (its logout address), and wait until the session is gone.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: And we log out
 * Example #5: Then I log out
 */
When(/^(I |we )*log out$/, async function (_who) {
  await h.open(this, '/auth/logout');
  const gone = await h.waitForValue(() => h.currentUser(this), (email) => email === '', h.budget(this));
  if (!gone.ok) throw friendly({ message: `Logging out did not end the session of ${gone.value}.`, hint: 'The site logs out at /auth/logout and goes back to its login form.' });
});

/**
 * The browser's session is an account's: its e-mail address, or its whole name as the site shows it.
 *
 * Example #1: Then I should be logged in as "Member Test"
 * Example #2: Then I should be logged in as "member@example.com"
 * Example #3: And I should be logged in as "Member Test"
 * Example #4: But I should be logged in as "member@example.com"
 * Example #5: Then we should be logged in as "Member Test"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (_who, who) {
  const wanted = String(who).trim().toLowerCase();
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => !!me && (me.email.toLowerCase() === wanted || me.full.toLowerCase() === wanted), h.budget(this));
  if (!result.ok) {
    const me = result.value;
    throw friendly({ message: `Expected to be logged in as "${who}", but ${me ? `the session is ${me.full} (${me.email})` : 'there is no session'}.`, hint: 'Name the account by its e-mail address or by its whole name, as the site shows it.' });
  }
});

/**
 * The browser holds no session of the site's.
 *
 * Example #1: Then I should not be logged in
 * Example #2: Then we should not be logged in
 * Example #3: And I should not be logged in
 * Example #4: But we should not be logged in
 * Example #5: Given I should not be logged in
 */
Then(/^(I |we )*should not be logged in$/, async function (_who) {
  const result = await h.waitForValue(() => h.currentUser(this), (email) => email === '', h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected no session, but the session is ${result.value}'s.`, hint: 'Log out first, or start with Given I am not logged in.' });
});

/**
 * The login form came back with the site's message: the account was refused.
 *
 * Example #1: Then the login should be refused with "Username or password incorrect"
 * Example #2: Then the login should be refused with "incorrect"
 * Example #3: And the login should be refused with "Username or password incorrect"
 * Example #4: But the login should be refused with "incorrect"
 * Example #5: Given the login should be refused with "Username or password incorrect"
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (message) {
  const page = this.page;
  const form = page.locator('input[name="password"]');
  await h.assertPresence(form, null, { label: 'the login form', hint: 'A refused login comes back to the form at /auth/login.', timeout: h.budget(this) });
  const said = page.getByText(new RegExp(h.escapeRegExp(message), 'i'));
  await h.assertPresence(said, null, { label: `the message "${message}"`, hint: 'The site says "Username or password incorrect!" under the form.', timeout: h.budget(this) });
});

/**
 * Open a project by its name: its tasks, on its own page.
 *
 * Example #1: When I open the project "Webship site"
 * Example #2: When we open the project "Webship site"
 * Example #3: And I open the project "Webship site"
 * Example #4: And we open the project "Webship site"
 * Example #5: Then I open the project "Webship site"
 */
When(/^(I |we )*open the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  this.leantime = this.leantime || {};
  this.leantime.project = project.name;
  await h.open(this, `/projects/changeCurrentProject/${project.id}`);
  await h.open(this, '/tickets/showAll');
});

/**
 * The browser's account is refused a project: the site does not open it for an account that is not in its team.
 *
 * Example #1: Then I should be refused the project "Webship site"
 * Example #2: Then we should be refused the project "Webship site"
 * Example #3: And I should be refused the project "Webship site"
 * Example #4: But we should be refused the project "Webship site"
 * Example #5: Given I should be refused the project "Webship site"
 */
Then(/^(I |we )*should be refused the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  const r = await h.rpcWith(this.context.request, h.siteRoot(this), 'Tickets.Tickets.getAll', { searchCriteria: { currentProject: Number(project.id), excludeType: 'milestone' }, limit: 5 });
  const rows = Array.isArray(r.result) ? r.result : [];
  if (rows.length) throw friendly({ message: `Expected the project "${name}" to be refused, but the account reads ${rows.length} of its tasks.`, hint: 'An account in the project\'s team may open it; only one outside the team is refused.' });
  await h.open(this, `/projects/changeCurrentProject/${project.id}`);
  const opened = await this.page.getByText(project.name, { exact: true }).first().isVisible().catch(() => false);
  const tasks = await this.page.locator('a[href*="/tickets/showTicket/"]').count().catch(() => 0);
  if (opened && tasks) throw friendly({ message: `Expected the project "${name}" to be refused, but its page shows ${tasks} task link(s).`, hint: 'An account outside the project\'s team should not see its tasks.' });
});

// A scenario's tasks go after it, as the managing account, so a run leaves the site as it found it.
After(async function () {
  const made = this.leantime && this.leantime.made;
  if (!made || !made.size) return;
  for (const id of made) await h.removeTask(this, id).catch(() => {});
  made.clear();
});

AfterAll(async function () {
  await h.managerContexts.dispose();
});
