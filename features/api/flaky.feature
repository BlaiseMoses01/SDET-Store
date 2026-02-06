@api @resilience
Feature: Flaky API

  @guest
  Scenario: Flaky endpoint fails then succeeds
    Given I have a client id for retries
    When I GET /api/flaky multiple times
    Then the first responses should be errors
    And a later response should be successful
    And error responses should include "temporary_failure"
