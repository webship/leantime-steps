@tasks
Feature: The tasks of a project
  An Editor reads the project's tasks, makes one, sets its status, comments on it, assigns it and logs time on it;
  what a scenario makes goes after it.

  Scenario: A member reads the project's tasks
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the task list should show "The greeting script says Helo instead of Hello"
    And the task list should show "The usage line spells greeting as greting"

  Scenario: A member makes a task on the board
    Given there is no task "Webship test new" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I create a task "Webship test new" in the project "Webship site"
    And I open the project "Webship site"
    Then the task list should show "Webship test new"

  Scenario: A member works a task: its status, a comment, its assignee and the time on it
    Given there is a task "Webship test work" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test work"
    And I set the status of the task to "In Progress"
    Then the status of the task should be "In Progress"
    When I add the comment "Checked on the test site" to the task
    Then the task should show the comment "Checked on the test site" by "Member Test"
    When I assign the task to "Member Test"
    Then the task should be assigned to "Member Test"
    When I log "1.5" hours on the task with the note "Looked into it"
    Then the task should have "1.5" hours logged

  Scenario: The sample task tells who made it
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be created by "Owner"
    And the task should be assigned to "Member Test"
