@sprints
Feature: The sprints of a project
  A sprint lists the tasks put in it, and no other.

  Scenario: The sprint lists its task
    Given I am a logged in user with the "member" user
    When I open the sprint "Sprint 1" of the project "Webship site"
    Then the sprint should list the task "The greeting script says Helo instead of Hello"
    And the sprint should not list the task "The usage line spells greeting as greting"
