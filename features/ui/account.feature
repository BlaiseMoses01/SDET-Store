@ui @account
Feature: Account UI

  @user
  Scenario: Account page shows user profile
    Given I am logged in
    When I visit the account page
    Then I should see my name and email

  @guest
  Scenario: Account page redirects guests to login
    Given I am not logged in
    When I visit the account page
    Then I should be redirected to the login page

