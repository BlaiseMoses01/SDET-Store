@api @auth
Feature: Authentication API

  @guest
  Scenario: Login returns a session cookie
    Given I have valid user credentials
    When I POST to /api/login
    Then the response status should be 200
    And a session cookie should be set

  @guest @error
  Scenario: Login with missing credentials is rejected
    Given I have no credentials
    When I POST to /api/login
    Then the response status should be 400
    And the error should be "missing_credentials"

  @guest @error
  Scenario: Login with invalid credentials is rejected
    Given I have invalid user credentials
    When I POST to /api/login
    Then the response status should be 401
    And the error should be "invalid_credentials"

  @guest @error @xfail-buggy-api-auth-1
  Scenario: /api/me without a session is unauthorized
    Given I am not authenticated
    When I GET /api/me
    Then the response status should be 401
    And the error should be "unauthorized"

  @user
  Scenario: /api/me returns the current user
    Given I am authenticated via the API
    When I GET /api/me
    Then the response should include my user profile

  @user
  Scenario: Logout clears the session
    Given I am authenticated via the API
    When I POST to /api/logout
    Then the response status should be 200
    And my session should be invalidated

  @guest @error @xfail-buggy-api-auth-2
  Scenario: Login with wrong password for existing user is rejected
    Given I have credentials for "alice@example.com" with a wrong password
    When I POST to /api/login
    Then the response status should be 401
    And the error should be "invalid_credentials"
