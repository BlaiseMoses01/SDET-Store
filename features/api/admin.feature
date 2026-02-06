@api @admin
Feature: Admin API

  @admin @error
  Scenario: Admin endpoints are disabled without a token
    Given ADMIN_TOKEN is not configured
    When I GET /__admin/mode
    Then the response status should be 501
    And the error should be "admin_disabled"

  @admin @error
  Scenario: Admin endpoints reject invalid tokens
    Given ADMIN_TOKEN is configured
    When I GET /__admin/mode with an invalid token
    Then the response status should be 403
    And the error should be "forbidden"

  @admin
  Scenario: Get current bug mode
    Given I have a valid admin token
    When I GET /__admin/mode
    Then the response status should be 200
    And the response should include the current mode

  @admin @error
  Scenario: Setting mode without a body is rejected
    Given I have a valid admin token
    When I POST /__admin/mode without a body
    Then the response status should be 400
    And the error should be "missing_mode"

  @admin @error
  Scenario: Setting an invalid mode is rejected
    Given I have a valid admin token
    When I POST /__admin/mode with an invalid mode
    Then the response status should be 400
    And the error should be "invalid_mode"

  @admin
  Scenario: Set bug mode
    Given I have a valid admin token
    When I POST /__admin/mode with a valid mode
    Then the response should include the updated mode

  @admin
  Scenario: Reseed database
    Given I have a valid admin token
    When I POST /__admin/seed
    Then the response should include a seed summary
