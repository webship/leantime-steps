@must-fail
Feature: Assertions that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A session that is not the account named
    Fails with: Expected to be logged in as "Owner Test", but the session is Member Test (member@example.com).
    Given I am a logged in user with the "member" user
    Then I should be logged in as "Owner Test"

  Scenario: A session that is there
    Fails with: Expected no session, but the session is member@example.com's.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: A login that worked is not refused
    Fails with: Expected to see the login form, but it did not appear within
    Given I am not logged in
    When I log in with the "member" user
    Then the login should be refused with "Username or password incorrect"

  Scenario: A task the list does not show
    Fails with: Expected to see the task "Webship test nothing" in the list, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the task list should show "Webship test nothing"

  Scenario: A status the task is not in
    Fails with: Expected the task's status to be "Done", but it is "In Progress".
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the status of the task should be "Done"

  Scenario: A comment the task does not have
    Fails with: to show the comment "Webship test nothing". Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Webship test nothing"

  Scenario: A comment by another account
    Fails with: to show the comment "Seen on the test site" by Member Test. Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Seen on the test site" by "Member Test"

  Scenario: An assignee the task does not have
    Fails with: Expected the task to be assigned to "Owner Test", but it is assigned to Member Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be assigned to "Owner Test"

  Scenario: A maker the task does not have
    Fails with: Expected the task to be created by "Member", but it was created by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be created by "Member"

  Scenario: Time the task does not have
    Fails with: hours logged on the task
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should have "9" hours logged

  Scenario: An Editor may change a task
    Fails with: Expected the task to be closed to this account, but its window lets it save the task.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to change the task

  Scenario: An Editor may comment on a task
    Fails with: Expected no way to comment on the task, but its Discussion offers "Add a new comment".
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to comment on the task

  Scenario: An Editor may make a task
    Fails with: Expected no way to make a task in Webship site, but its board offers "Add To-Do".
    Given I am a logged in user with the "member" user
    Then I should not be able to create a task in the project "Webship site"

  Scenario: A member of the team is not refused the project
    Fails with: Expected the project "Webship site" to be refused, but the account reads 2 of its tasks.
    Given I am a logged in user with the "member" user
    Then I should be refused the project "Webship site"

  Scenario: A member of the team is not refused a task
    Fails with: to be refused, but the account reads it ("The greeting script says Helo instead of Hello").
    Given I am a logged in user with the "member" user
    Then I should be refused the task "The greeting script says Helo instead of Hello"

  Scenario: A task the sprint does not list
    Fails with: Expected to see the task "The usage line spells greeting as greting" in the sprint Sprint 1, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the sprint "Sprint 1" of the project "Webship site"
    Then the sprint should list the task "The usage line spells greeting as greting"
