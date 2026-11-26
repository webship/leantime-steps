<p align="center"><img src="https://raw.githubusercontent.com/webship/leantime-steps/2.0.x/assets/logo.svg" alt="Leantime logo" width="180"></p>

# leantime-steps

[![Test](https://github.com/webship/leantime-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/leantime-steps/actions/workflows/test.yml)

Cucumber step definitions for testing Leantime, the open-source project management software, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js. The pack covers what a project's work goes through:

- **logging in and out**: an account of the users registry by its handle, the login form, a refused login, who the
  session is, logging out;
- **a project**: opened by its name, and refused to an account outside its team;
- **the task list** of a project, and **one task** in its window: its status, a comment, its assignee and the time
  logged on it, each through its own control, and who made it;
- **a new task** made on the project's board;
- **the sprints**: what a sprint holds;
- **what an account may not do**: a Commenter changes no task, a Read Only person neither changes nor comments on one,
  and an account outside the team is refused the project's tasks.

The steps make and remove their test content through the site's own API, as a managing account (a Company Manager)
logged in the way the screens log in: a task a scenario makes goes after it, so a run leaves the site as it found it.

No step phrase names the platform: a scenario reads `When I set the status of the task to "In Progress"` and
`Then the sprint should list the task "…"`.

CI builds a real Leantime site with [DDEV](https://ddev.com) on the runner (Leantime's own image on the project's own
MariaDB, installed by its own installer, the accounts of the suite, the sample content), runs the whole suite against it
twice on every push and pull request, checks after each run that the site holds what it held before, then runs the
assertions that must fail; see [The test site](#the-test-site) and [`.github/workflows/test.yml`](.github/workflows/test.yml).

## Logging in first

Every feature starts by logging in: an account of the users registry, by its handle.

| Step | What it does |
| --- | --- |
| `Given I am a logged in user with the "member" user` | Logs in as an account of the users registry, by its handle. The first time in a run through the login form, then its session is put back |
| `When I log in with the "member" user` | Fills and submits the login form with the account's address and password, and waits until the session is the account's |
| `When I log in as "member@example.com" with the password "wrong"` | Fills and submits the login form with an address and a password as typed, and asserts nothing: for scenarios about the login itself |
| `Given I am not logged in` | The browser forgets its session |
| `When I log out` | Logs out at the site's logout address, and waits until the session is gone |
| `Then I should be logged in as "Member Test"` | The session is the account's: its whole name as the site shows it, or its address |
| `Then I should not be logged in` | The browser holds no session |
| `Then the login should be refused with "Username or password incorrect"` | The login form came back with that message (give the scenario `@js-off`) |

```gherkin
Scenario: An account logs in through the form and out again
  Given I am not logged in
  When I log in with the "member" user
  Then I should be logged in as "Member Test"
  When I log out
  Then I should not be logged in
```

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, Node.js 24 or later with npm, and about 1.5 GB
of free memory for Leantime and MariaDB. Leantime runs in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project: Leantime's own image
(`leantime/leantime:3.17.0`, `RELEASE` for another release) on MariaDB 11.4, installed by Leantime's own installer, the
five accounts of [Test users](#test-users), and the sample content (see [The test site](#the-test-site)). It takes a
minute or two once the images are pulled (Leantime's is a download of about 320 MB). Leantime supports MySQL 8.0+ or
MariaDB 10.6+; the test site runs MariaDB, as the Webship Workspace builds Leantime.

```bash
git clone https://github.com/webship/leantime-steps.git
SITE_DIR="$PWD/leantime-site" leantime-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://leantimesteps.ddev.site`. In the [Webship Workspace](https://github.com/webship/workspace),
its Leantime plugin builds the same site in a sites folder, on DDEV, and wires this pack into the testing setup of the
site:

```bash
bash core/scripts/plugins.sh --require leantime --with-needs
bash core/scripts/plugins.sh --activate leantime --with-needs
bash core/scripts/plugins.sh --install leantime
bash dev/cmd-leantime-project.sh ltsite --install --add-users --sample-content
bash dev/cmd-tools-testing.sh ltsite --run
```

**2. A test project.**

```bash
mkdir leantime-tests && cd leantime-tests
npm init -y
npm install --save-dev webship-js @webship-js/leantime-steps
npx init-webship-js
```

**3. `cucumber.js`.** Add the pack's step definitions after webship-js's own, and give the world its parameters:

```javascript
require: [
  'node_modules/webship-js/tests/step-definitions/**/*.js',
  'node_modules/@webship-js/leantime-steps/tests/step-definitions/**/*.js',
],
tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || 'https://leantimesteps.ddev.site',
  // The account that makes and removes test content through the site's API: a Company Manager of the projects used.
  manager: process.env.MANAGER || 'owner',
  // The project a step works in when it names none (its name).
  project: process.env.PROJECT || 'Webship site',
  // Leantime logs in with the address (username), and shows the whole name (name).
  users: {
    owner: { username: process.env.LEANTIME_OWNER_USER || 'owner@example.com', password: process.env.LEANTIME_OWNER_PASSWORD, name: 'Owner Test' },
    member: { username: process.env.LEANTIME_MEMBER_USER || 'member@example.com', password: process.env.LEANTIME_MEMBER_PASSWORD, name: 'Member Test' },
    commenter: { username: process.env.LEANTIME_COMMENTER_USER || 'commenter@example.com', password: process.env.LEANTIME_COMMENTER_PASSWORD, name: 'Commenter Test' },
    reader: { username: process.env.LEANTIME_READER_USER || 'reader@example.com', password: process.env.LEANTIME_READER_PASSWORD, name: 'Reader Test' },
    stranger: { username: process.env.LEANTIME_STRANGER_USER || 'stranger@example.com', password: process.env.LEANTIME_STRANGER_PASSWORD, name: 'Stranger Test' },
  },
  // … webship-js's own parameters (minWaitTime, screenshot, javascript …)
},
```

This repository's own [`cucumber.js`](cucumber.js) is a whole example.

**4. Run.**

```bash
npx cucumber-js                                  # every feature
npx cucumber-js tests/features/tasks.feature     # one feature
CUCUMBER_TAGS=@sprints npx cucumber-js           # one tag
```

## Steps

### Projects

| Step | What it does |
| --- | --- |
| `When I open the project "Webship site"` | Opens the project, by its name: its task list |
| `Then I should be refused the project "Webship site"` | The session reads none of its tasks, and its page shows none (`@js-off`) |

### Test content

| Step | What it does |
| --- | --- |
| `Given there is a task "Webship test …" in the project "Webship site"` | Makes it through the site's API as the managing account, when it is not there. It goes after the scenario |
| `Given there is no task "Webship test …" in the project "Webship site"` | Removes any of the title |

### The task list

| Step | What it does |
| --- | --- |
| `Then the task list should show "…"` / `should not show "…"` | A task of the title is (not) in the open project's list |
| `When I create a task "Webship test …" in the project "Webship site"` | Through the board's "Add To-Do": its title, then Enter. It goes after the scenario |

### One task

A task opens in a window of the page. The steps find that window by the task's own address (its form sends to
`/tickets/showTicket/<number>`), never by its place on the page, and read what they changed back from the site's API.

| Step | What it does |
| --- | --- |
| `When I open the task "…"` | Opens it by its title, or by its number ("#1") |
| `When I set the status of the task to "In Progress"` | Through its status list, then Save |
| `Then the status of the task should be "In Progress"` | The status it has now |
| `When I add the comment "…" to the task` | Through "Add a new comment" in its Discussion, its editor and Save |
| `Then the task should show the comment "…"` (`… by "Member Test"`) | It holds the comment, written by that person when one is named, and its window shows it |
| `When I assign the task to "Owner Test"` | Through its assignee list, then Save: someone of the project's team, by their whole name |
| `Then the task should be assigned to "Owner Test"` | Its assignee now |
| `When I log "1.5" hours on the task with the note "…"` | Through its Time Tracking: the hours and the note, then Save |
| `Then the task should have "1.5" hours logged` | The time logged on it in all, by everyone |
| `Then the task should be created by "Owner"` | Who made it, by their first or whole name, as its window says ("Created by …") |

### What an account may not do

| Step | What it does |
| --- | --- |
| `Then I should not be able to change the task` | Its Save buttons and its assignee list are disabled (a Commenter's, a Read Only person's) |
| `Then I should not be able to comment on the task` | Its Discussion offers no new comment (a Read Only person's) |
| `Then I should not be able to create a task in the project "Webship site"` | The project's board offers no "Add To-Do" (a Commenter's, a Read Only person's) |
| `Then I should be refused the task "…"` | The session reads nothing of it, and gets no window of it (an account outside the team) (`@js-off`) |

### Sprints

| Step | What it does |
| --- | --- |
| `When I open the sprint "Sprint 1" of the project "Webship site"` | The project's task list, of that sprint only |
| `Then the sprint should list the task "…"` / `should not list` | What it holds |

Every step carries five example phrasings in its JSDoc, and `npm run test:examples` checks that each one matches its
own step only.

## Rules of a suite

- Log in by a handle of the users registry; never write a password into a feature.
- Never create or delete an account in a suite: accounts are configuration, made by the build of the site.
- Change only what the scenario made: a status, a comment, an assignee and logged time go on a task of
  `Given there is a task "…"`, which goes after the scenario.
- Name test content "Webship test …". A run that was stopped half way leaves its tasks; the Workspace's
  `cmd-tools-leantime-cli.sh <site> --tidy` deletes them for good (only tasks of that title made by the test accounts
  in the sample project), or delete them as the managing account.
- Leantime's own delete of a task keeps its comments, its logged time and its history in its database, out of every
  screen and every answer of its API: the counts CI compares are the same after a run. The same `--tidy` (or
  `TIDY_ONLY=1 .github/scripts/build-ddev-site.sh`, which CI runs last) removes what the test accounts left there.
- A refusal (a wrong password, a project or a task an account may not see) makes the browser log the refused requests:
  give those scenarios `@js-off`.
- Leantime shows a person the window of help of a screen once a session ("I'll explore on my own"). The steps close
  one when it shows, by its own button, and the run says so (`[leantime-steps] a tour of … showed and was closed`).
  "Don't show this again" is the person's own setting: a run leaves it as it is. The site keeps one window at a time,
  and a window of help that comes over a task's takes the task's with it when it closes: the steps open the board and
  close its window of help first, then ask for the task, and ask again when one came over it.
- Leantime allows a set number of API calls a minute for an account (120 by default, `LEAN_RATELIMIT_API`) and of
  logins from one address (20, `LEAN_RATELIMIT_AUTH`). A suite reads and logs in more often than a person, so the test
  site allows 1000 and 100, a setting for a test site only. The pack reads the site once a second while it waits,
  reads the managing account's projects once a run, and puts each account's session back after its first login.

## Test users

The accounts the features log in as, each with the password `dD.123123ddd`:

| Handle | Address | Whole name | Role in Webship site |
| --- | --- | --- | --- |
| `owner` | `owner@example.com` | Owner Test | Company Manager (the managing account) |
| `member` | `member@example.com` | Member Test | Editor |
| `commenter` | `commenter@example.com` | Commenter Test | Commenter: comments, and changes no task |
| `reader` | `reader@example.com` | Reader Test | Read Only: reads, and neither changes nor comments |
| `stranger` | `stranger@example.com` | Stranger Test | An Editor outside the project's team |

## The test site

`.github/scripts/build-ddev-site.sh` builds it, and `COUNTS_ONLY=1` makes it print what the sample project holds
(tasks, open ones, comments, assignees, tagged tasks, tasks in sprints, sprints, time entries, history entries, members
of the project, users): CI compares them before and after each run. The sample content, in the project Webship site:

- "The greeting script says Helo instead of Hello" (#1): by the owner, In Progress, high, assigned to the member, tagged
  bug, in the sprint "Sprint 1", with the owner's comment and 1.5 hours the member logged;
- "The usage line spells greeting as greting" (#2): by the member, New, with the commenter's comment from outside the
  project's editors.

Leantime's installer, run from its console, cannot fill its own onboarding project ("My Project") with its sample
tasks, which it adds as a person: that project is empty on purpose, and the sample project is the build's own.

The features read the sample content and never change it. The site script (`site/leantime-site.php`, run with
Leantime's own code in its container) is the one of the Webship Workspace's Leantime plugin.

## The assertions that must fail

`tests/must-fail/` holds scenarios that assert something that is not true on the test site; `npm run test:must-fail`
runs them and checks that each fails at its last step with the message its description announces, and a hint. A step
that cannot fail proves nothing.

## Logo

The logo is Leantime's own wordmark, from its repository (`public/assets/images/logo_blue.svg` at v3.17.0), which is
licensed AGPL-3.0 as a whole; the name and the mark are Leantime's. It names the platform the pack tests.

## License

MIT (see `LICENSE`). Leantime itself is AGPL-3.0: the pack drives a running site and carries none of its code. Its
repository's acceptance tests were read for their flows only.
