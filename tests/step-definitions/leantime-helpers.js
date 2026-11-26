'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the steps use and that
// another pack can require instead of copying: the wait budget, presence assertions with friendly errors, URL
// building, a page's tour closed when it shows, the users registry, signing in (the form, and a session put back),
// the site's own API as the managing account (the test content a scenario makes and removes), the open task found by
// its own address, and the tasks a scenario made, which go after it.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`, `waitForPageLoad`, `friendly`) so the
// steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [require.resolve('webship-js/package.json')] })); }

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 15 seconds (the site's screens load
 * their data after the page), so a slow screen does not fail an assertion that would pass a moment later. Kept below
 * webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 15000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case), for exact names and labels.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$', 'i');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target, cause and a hint) instead of
 * Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match and fail with a friendly error
 * otherwise: the wait and the assertion are one call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value read, so a value that changes a moment
 * after the action (a status after a save) still passes. A read is an answer of the site's API, which the site
 * limits a minute for an account: once a second, by default.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @param {number} [every] - milliseconds between two reads
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout, every = 1000) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Whether a window of help shows: the site shows a person the one of a screen once a session ("I'll explore on my
 * own" / "Take the tour").
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function tourShown(world) {
  return world.page.getByRole('link', { name: "I'll explore on my own" }).first().isVisible().catch(() => false);
}

/**
 * Close a screen's window of help when one shows, by its own button ("I'll explore on my own"), and say so in the
 * run, so a step reads the screen under it. "Don't show this again" is left as it is: that is the person's own
 * setting, which a run does not change. Nothing happens when none shows.
 *
 * @param {object} world
 */
async function closeTour(world) {
  const page = world.page;
  if (!(await tourShown(world))) return;
  await page.getByRole('link', { name: "I'll explore on my own" }).first().click().catch(() => {});
  await page.getByRole('link', { name: "I'll explore on my own" }).first().waitFor({ state: 'hidden', timeout: budget(world) }).catch(() => {});
  console.log(`[leantime-steps] a tour of ${page.url().replace(siteRoot(world), '') || '/'} showed and was closed with "I'll explore on my own".`);
}

/**
 * Open a page of the site, wait for it to settle, and close a tour if one shows. The site draws parts of its screens
 * after the page has loaded, so a step waits on what it needs next.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  await gotoUrl(world.page, siteUrl(world, url));
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
  await closeTour(world);
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`): its e-mail address (`username`, which the
 * site logs in with), its password, and the whole name the site shows (`name`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}@example.com', password: process.env.LEANTIME_${handle.toUpperCase()}_PASSWORD, name: '${handle}' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  const username = entry.username || handle;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `The account "${handle}" has no password in the users registry.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, from an environment variable.`,
    });
  }
  return { username, password, name: entry.name || handle };
}

/**
 * One call of the site's JSON-RPC API in a request context that holds a session: the site takes the session's cookie
 * with the header its own screens send (X-Requested-With). Its result, or the error it gave.
 *
 * @param {import('playwright').APIRequestContext} request
 * @param {string} root
 * @param {string} method - "Tickets.Tickets.getTicket"
 * @param {object} params
 * @returns {Promise<{status: number, result: *, error: *}>}
 */
async function rpcWith(request, root, method, params) {
  const r = await request.post(`${root}/api/jsonrpc`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    data: { jsonrpc: '2.0', method: `leantime.rpc.${method}`, params: params || {}, id: 1 },
    ignoreHTTPSErrors: true, failOnStatusCode: false, maxRedirects: 0,
  });
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status(), result: body ? body.result : undefined, error: body ? body.error : undefined };
}

/**
 * Whether the browser's context holds a session: the site keeps its session cookie only once someone logged in.
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function hasSession(world) {
  const cookies = await world.context.cookies(siteRoot(world)).catch(() => []);
  return cookies.some((c) => /session/i.test(c.name));
}

/**
 * The account the browser's session is of, as the site's own API answers it (its e-mail address and its whole name),
 * or null for a visitor. A context with no session asks nothing: the site counts every refused call of its API.
 *
 * @param {object} world
 * @returns {Promise<{email: string, full: string}|null>}
 */
async function currentAccount(world) {
  if (!(await hasSession(world))) return null;
  const r = await rpcWith(world.context.request, siteRoot(world), 'Users.Users.getUser', {}).catch(() => null);
  const me = r && r.status === 200 ? r.result : null;
  if (!me || !me.username) return null;
  return { email: String(me.username), full: tidy(`${me.firstname || ''} ${me.lastname || ''}`) };
}

/**
 * The e-mail address of the account the browser's session is of; an empty string for a visitor.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function currentUser(world) {
  const me = await currentAccount(world);
  return me ? me.email : '';
}

/**
 * Forget the browser's session: the page is emptied first, so no request of the site brings a new session back.
 *
 * @param {object} world
 */
async function dropSession(world) {
  if (world.page.url() !== 'about:blank') await world.page.goto('about:blank').catch(() => {});
  await world.context.clearCookies();
}

/**
 * Fill and submit the login form: the e-mail address and the password, then Login. It asserts nothing: a wrong
 * password comes back to the form with the site's message.
 *
 * @param {object} world
 * @param {string} email
 * @param {string} password
 */
async function submitLogin(world, email, password) {
  const page = world.page;
  await open(world, '/auth/login');
  await actOrExplain('fill in the login form for', email, async () => {
    const field = page.locator('input[name="username"]');
    await field.waitFor({ state: 'visible', timeout: budget(world) });
    await field.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="login"]').click();
  }, 'The login form (its fields username and password) did not show at /auth/login. A session that is already open goes to its dashboard instead; a site that signs in through another provider only has no such form.');
  await smartSettle(page, 2000);
}

const sessions = new Map();

/**
 * Sign in with an account of the users registry and make sure the session is that account's. An account that is
 * already signed in is kept; an account that signed in earlier in the run gets its session back; otherwise the account
 * goes through the login form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const key = siteRoot(world) + '|' + handle;
  const same = (email) => String(email).toLowerCase() === String(user.username).toLowerCase();
  if (same(await currentUser(world))) {
    if (world.page.url() === 'about:blank' || !world.page.url().startsWith(siteRoot(world))) await open(world, '/dashboard/home');
    return;
  }
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await world.context.addCookies(saved);
    if (same(await currentUser(world))) {
      await open(world, '/dashboard/home');
      return;
    }
    sessions.delete(key);
    await dropSession(world);
  }
  await submitLogin(world, user.username, user.password);
  const result = await waitForValue(() => currentUser(world), same, budget(world));
  if (!result.ok) {
    const said = tidy(await world.page.locator('.inputwrapper .error, .alert, [role="alert"], form p').first().innerText({ timeout: 1500 }).catch(() => ''));
    throw friendly({
      message: `Logging in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : `; the page is ${world.page.url()}`}.`,
      hint: 'Check the e-mail address and the password of this account in worldParameters.users of cucumber.js, and that the account exists on the site, is active, and may log in.',
    });
  }
  await closeTour(world);
  sessions.set(key, await world.context.cookies());
}

// ---------------------------------------------------------------------------
// The site's own API, as the managing account
// ---------------------------------------------------------------------------

const managers = new Map();

/** The managing accounts' sessions of a run, all of them, and their end. */
const managerContexts = {
  async dispose() {
    for (const m of managers.values()) await m.dispose().catch(() => {});
    managers.clear();
  },
};

/**
 * A session of its own for the managing account (`worldParameters.manager`, a handle of the users registry), for the
 * test content a scenario makes and removes: it logs in through the site's login form (with the form's own token) and
 * calls the JSON-RPC API the screens call, with that session. It never touches the browser's session.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').APIRequestContext>}
 */
async function managerSession(world) {
  const handle = (world.parameters && world.parameters.manager) || 'owner';
  const root = siteRoot(world);
  const key = root + '|' + handle;
  if (managers.has(key)) return managers.get(key);
  const user = resolveUser(world, handle);
  const ctx = await playwright.request.newContext({ baseURL: root, ignoreHTTPSErrors: true });
  const refuse = async (said) => {
    await ctx.dispose();
    throw friendly({
      message: `The managing account "${handle}" could not log in to ${root} for the test content: ${said}.`,
      hint: 'Check worldParameters.manager and the account in worldParameters.users of cucumber.js: a Company Manager (or above) of the projects the features use, who logs in with an e-mail address and a password.',
    });
  };
  const form = await ctx.get('/auth/login', { failOnStatusCode: false });
  const token = ((await form.text().catch(() => '')).match(/name="_token" value="([^"]+)"/) || [])[1] || '';
  if (!token) return refuse(`the login page gave no form token (it answered ${form.status()})`);
  const login = await ctx.post('/auth/login', { form: { _token: token, username: user.username, password: user.password, login: 'Login', redirectUrl: '' }, maxRedirects: 0, failOnStatusCode: false });
  if (/\/auth\/login/.test(String(login.headers().location || '')) || login.status() === 200) return refuse('the site refused the e-mail address and the password');
  const me = await rpcWith(ctx, root, 'Users.Users.getUser', {});
  if (!me.result || String(me.result.username || '').toLowerCase() !== String(user.username).toLowerCase()) return refuse(`its session is not the account's (the site answered ${me.status})`);
  managers.set(key, ctx);
  return ctx;
}

/**
 * One call of the site's JSON-RPC API as the managing account: its result, or a friendly error with the site's words.
 *
 * @param {object} world
 * @param {string} method - "Tickets.Tickets.addTicket"
 * @param {object} params
 * @param {string} what - what the call does, for the error ("make the task …")
 * @returns {Promise<*>}
 */
async function api(world, method, params, what) {
  const ctx = await managerSession(world);
  const r = await rpcWith(ctx, siteRoot(world), method, params);
  if (r.status !== 200 || r.error) {
    const said = r.error && typeof r.error === 'object' ? tidy(`${r.error.message || ''} ${typeof r.error.data === 'string' ? r.error.data : ''}`) : '';
    throw friendly({
      message: `Could not ${what}: the site answered ${r.status}${said ? ` (${said})` : ''}.`,
      hint: r.status === 429
        ? 'The site limits the calls of its API a minute for an account (120 by default, LEAN_RATELIMIT_API; more on a test site the Webship Workspace builds): wait a minute, or raise it for the test site.'
        : 'The managing account (worldParameters.manager) must be a Company Manager or above, in the team of the projects the features use.',
    });
  }
  return r.result;
}

/**
 * A project by its name ("Webship site"), among the ones the managing account is in: { id, name }. The step's
 * project, else the one of cucumber.js.
 *
 * @param {object} world
 * @param {string} [which]
 */
const projectLists = new Map();

async function findProject(world, which) {
  const wanted = String(which || (world.parameters && world.parameters.project) || '').trim();
  const manager = resolveUser(world, (world.parameters && world.parameters.manager) || 'owner');
  // The managing account's projects are read once a run: the site limits its API calls a minute.
  const key = siteRoot(world) + '|' + manager.username;
  if (!projectLists.has(key)) {
    const me = await api(world, 'Users.Users.getUser', {}, 'read the managing account');
    projectLists.set(key, await api(world, 'Projects.Projects.getProjectsAssignedToUser', { userId: Number(me.id) }, `read the projects of ${manager.username}`));
  }
  const list = projectLists.get(key);
  const found = (Array.isArray(list) ? list : []).find((p) => exactly(wanted).test(String(p.name)));
  if (!found) throw friendly({ message: `There is no project "${wanted}" that the managing account is in.`, hint: 'Name the project as the site shows it (Webship site); the managing account must be in its team.' });
  return { id: String(found.id), name: String(found.name) };
}

/**
 * The tasks of a project whose title is the text (or whose number is, as "#1"), milestones left out.
 *
 * @param {object} world
 * @param {{id: string}} project
 * @param {string} title
 * @returns {Promise<object[]>}
 */
async function findTasks(world, project, title) {
  const list = await api(world, 'Tickets.Tickets.getAll', { searchCriteria: { currentProject: Number(project.id), excludeType: 'milestone', status: 'all' }, limit: 1000 }, `look for the task "${title}"`);
  const number = String(title).trim().replace(/^#/, '');
  return (Array.isArray(list) ? list : []).filter((t) => t.type !== 'milestone' && (exactly(title).test(String(t.headline)) || String(t.id) === number));
}

/**
 * The one task of a title or a number in a project (the step's, else the last one a scenario used): { id, headline,
 * project }.
 *
 * @param {object} world
 * @param {string} title
 * @param {string} [projectName]
 */
async function taskNamed(world, title, projectName) {
  const project = await findProject(world, projectName || (world.leantime && world.leantime.project));
  const found = await findTasks(world, project, title);
  if (!found.length) throw friendly({ message: `There is no task "${title}" in the project ${project.name}.`, hint: 'Make it first with Given there is a task "…" in the project "…", or name a task of the sample content (its title, or its number as #1).' });
  return { id: String(found[0].id), headline: String(found[0].headline), project };
}

/**
 * Remember a task a scenario made, so it goes after the scenario.
 *
 * @param {object} world
 * @param {string} id
 */
function remember(world, id) {
  world.leantime = world.leantime || {};
  world.leantime.made = world.leantime.made || new Set();
  world.leantime.made.add(String(id));
}

/**
 * Remove a task, as the managing account, with what the site keeps of it (its comments, its history, its time).
 *
 * @param {object} world
 * @param {string} id
 */
async function removeTask(world, id) {
  await api(world, 'Tickets.Tickets.delete', { id: Number(id) }, `remove the task #${id}`);
}

/**
 * Make a task as the managing account: the project's first status, a line of text.
 *
 * @param {object} world
 * @param {{id: string}} project
 * @param {string} title
 * @returns {Promise<string>} its number
 */
async function makeTask(world, project, title) {
  const made = await api(world, 'Tickets.Tickets.addTicket', { values: { headline: title, description: '<p>Made by a test scenario; it goes after the scenario.</p>', projectId: Number(project.id), type: 'task', status: 3 } }, `make the task "${title}"`);
  const id = String(Array.isArray(made) ? made[0] : made);
  if (!/^[1-9][0-9]*$/.test(id)) throw friendly({ message: `The site made no task "${title}" (it answered ${JSON.stringify(made)}).`, hint: 'The managing account must be allowed to add tasks to the project.' });
  remember(world, id);
  return id;
}

/**
 * A sprint of a project by its name: { id, name }.
 *
 * @param {object} world
 * @param {{id: string, name: string}} project
 * @param {string} name
 */
async function findSprint(world, project, name) {
  const list = await api(world, 'Sprints.Sprints.getAllSprints', { projectId: Number(project.id) }, `read the sprints of ${project.name}`);
  const sprints = Array.isArray(list) ? list : [];
  const found = sprints.find((s) => exactly(name).test(String(s.name)));
  if (!found) throw friendly({ message: `There is no sprint "${name}" in the project ${project.name}. Its sprints: ${sprints.map((s) => `"${s.name}"`).join(', ') || 'none'}.`, hint: 'Name a sprint as the project shows it.' });
  return { id: String(found.id), name: String(found.name) };
}

// ---------------------------------------------------------------------------
// The open task
// ---------------------------------------------------------------------------

/**
 * The task the scenario opened (or the last one it named): its number, from the world.
 *
 * @param {object} world
 * @returns {string}
 */
function openTaskId(world) {
  const id = world.leantime && world.leantime.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  return id;
}

/**
 * The window of an open task, found by its own address: the site opens a task in a window of the page, whose form
 * sends to /tickets/showTicket/<number>. Never the first or the last window on the page.
 *
 * @param {object} world
 * @param {string} [id]
 * @returns {import('playwright').Locator}
 */
function taskWindow(world, id) {
  const n = id || openTaskId(world);
  return world.page.locator('.nyroModalCont').filter({ has: world.page.locator(`form[action$="/tickets/showTicket/${n}"]`) }).first();
}

/**
 * Open a task in its window, on the project's board, by the task's own address: Leantime opens the window from the
 * address's hash (#/tickets/showTicket/<number>), as its own links do. The board goes first, and its window of help
 * is closed when it shows: the site keeps one window at a time, and a window of help that comes over the task's takes
 * the task's with it when it closes. Then the task is asked for, and asked again when such a window came over it.
 * Waits until its window is there.
 *
 * @param {object} world
 * @param {{id: string, project: {id: string}}} task
 */
async function openTask(world, task) {
  await open(world, `/projects/changeCurrentProject/${task.project.id}`);
  await open(world, '/tickets/showKanban');
  world.leantime = world.leantime || {};
  world.leantime.task = task.id;
  world.leantime.project = task.project.name;
  const win = taskWindow(world, task.id);
  const ask = (n) => world.page.evaluate((id) => {
    if (window.location.hash) window.location.hash = '';
    window.location.hash = `#/tickets/showTicket/${id}`;
  }, String(n));
  await actOrExplain('open the task', `#${task.id}`, async () => {
    for (let attempt = 1; ; attempt += 1) {
      await ask(task.id);
      const shown = await win.waitFor({ state: 'visible', timeout: attempt < 3 ? 10000 : budget(world) }).then(() => true).catch(() => false);
      if (shown && !(await tourShown(world))) return;
      if (attempt >= 3) {
        if (shown) return;
        throw new Error(`its window did not show, asked for three times at #/tickets/showTicket/${task.id}`);
      }
      await closeTour(world);
      if (await win.isVisible().catch(() => false)) return;
    }
  }, 'The task\'s window did not open: the account must be in the project\'s team, and the task must be in the project.');
}

/**
 * Pick an option of one of the open task's lists (its status, its assignee): the site draws a list of its own over
 * the hidden select, which the select names by its data-id.
 *
 * @param {object} world
 * @param {string} field - the select's name: status, editorId
 * @param {string} label - the option, as the list shows it
 */
async function pickInTask(world, field, label) {
  const win = taskWindow(world);
  const select = win.locator(`select[name="${field}"]`).first();
  await select.waitFor({ state: 'attached', timeout: budget(world) });
  if (await select.isDisabled()) throw friendly({ message: `The task's ${field === 'editorId' ? 'assignee' : field} cannot be changed: its list is disabled for this account.`, hint: 'A Commenter or a Read Only person may change no task.' });
  const listId = await select.getAttribute('data-id');
  await win.locator(`.ss-main[data-id="${listId}"]`).click();
  const option = world.page.locator(`.ss-content[data-id="${listId}"] .ss-option`, { hasText: exactly(label) });
  const shown = await option.first().waitFor({ state: 'visible', timeout: budget(world) }).then(() => true).catch(() => false);
  if (!shown) {
    const offered = await world.page.locator(`.ss-content[data-id="${listId}"] .ss-option`).allInnerTexts().catch(() => []);
    throw friendly({ message: `The task's list offers no "${label}". It offers: ${offered.map((o) => `"${tidy(o)}"`).join(', ') || 'nothing'}.`, hint: 'Name an option as the list shows it.' });
  }
  await option.first().click();
}

/**
 * Save the open task (its Save button), and wait until the site has taken it.
 *
 * @param {object} world
 */
async function saveTask(world) {
  const save = taskWindow(world).locator('input[name="saveTicket"]:visible').first();
  if (await save.isDisabled()) throw friendly({ message: 'The task cannot be saved: its Save button is disabled for this account.', hint: 'A Commenter or a Read Only person may change no task.' });
  await save.click();
  await smartSettle(world.page, 2000);
}

/**
 * The task as the site's API gives it now, as the managing account.
 *
 * @param {object} world
 * @param {string} [id]
 */
async function taskNow(world, id) {
  return api(world, 'Tickets.Tickets.getTicket', { id: Number(id || openTaskId(world)) }, `read the task #${id || openTaskId(world)}`);
}

module.exports = {
  budget,
  escapeRegExp,
  exactly,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  siteRoot,
  siteUrl,
  tourShown,
  closeTour,
  open,
  resolveUser,
  rpcWith,
  currentAccount,
  currentUser,
  dropSession,
  submitLogin,
  signInAs,
  managerSession,
  managerContexts,
  api,
  findProject,
  findTasks,
  taskNamed,
  remember,
  removeTask,
  makeTask,
  findSprint,
  openTaskId,
  taskWindow,
  openTask,
  pickInTask,
  saveTask,
  taskNow,
};
