@ui @auth
Feature: Authentication UI

  @guest
  Scenario: Sign up with valid details creates an account and logs in
    Given I am on the sign up page
    When I submit the sign up form with valid details
    Then I should be redirected to the products page
    And I should see my account link in the nav

  @guest @error
  Scenario Outline: Sign up validation errors
    Given I am on the sign up page
    When I submit the sign up form with <invalid_case>
    Then I should see the signup error "<message>"

    Examples:
      | invalid_case               | message                                         |
      | a 1-character name         | Name must be at least 2 characters.             |
      | an invalid email           | Please enter a valid email address.             |
      | a short password           | Password must be at least 8 characters.         |
      | no uppercase in password   | Password must contain at least one uppercase letter. |
      | no number in password      | Password must contain at least one number.      |
      | mismatched confirm password| Passwords do not match.                         |

  @guest @xfail-buggy-auth-2
  Scenario: Sign up with an existing email shows an error
    Given I am on the sign up page
    When I submit the sign up form with an email that already exists
    Then I should see the signup error "An account with this email already exists."

  @guest
  Scenario: Login with valid credentials creates a session
    Given I am on the login page
    When I submit the login form with valid credentials
    Then I should be redirected to the products page

  @guest @error
  Scenario: Login with missing credentials shows an error
    Given I am on the login page
    When I submit the login form with missing email or password
    Then I should see the login error "Please enter both email and password."

  @guest @error
  Scenario: Login with invalid credentials shows an error
    Given I am on the login page
    When I submit the login form with invalid credentials
    Then I should see the login error "Invalid email or password."

  @guest @error @xfail-buggy-auth-1
  Scenario: Login with wrong password for Alice is rejected
    Given I am on the login page
    When I submit the login form with email "alice@example.com" and a wrong password
    Then I should see the login error "Invalid email or password."

  @user
  Scenario: Logout clears the session
    Given I am logged in
    When I log out
    Then I should be redirected to the login page

  @user @edge
  Scenario: Logged in users are redirected away from auth pages
    Given I am logged in
    When I visit the login page
    Then I should be redirected to the products page

  @user @edge
  Scenario: Logged in users are redirected away from sign up
    Given I am logged in
    When I visit the sign up page
    Then I should be redirected to the products page

  @user @edge @xfail-buggy-auth-3
  Scenario: Expired sessions are rejected
    Given I have an expired session cookie
    When I visit the products page
    Then I should be redirected to the login page
