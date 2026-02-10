@api @resilience
Feature: Flaky API

  @guest
  Scenario: Flaky endpoint fails then succeeds
    Given I have a client id for retries
    When I GET /api/flaky multiple times
    Then the first responses should be errors
    And a later response should be successful
    And error responses should include "temporary_failure"

  @guest @xfail-buggy-api-flaky-1
  Scenario: Flaky attempts are isolated per client
    Given I have two different client ids
    When client A triggers /api/flaky until success
    Then client B should still see failures first
