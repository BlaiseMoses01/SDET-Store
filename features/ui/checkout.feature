@ui @checkout
Feature: Checkout UI

  @user
  Scenario: Shipping step validates required fields
    Given I am logged in
    And I have items in my cart
    When I submit the shipping form with missing fields
    Then I should see shipping validation errors

  @user @error
  Scenario Outline: Shipping validation messages
    Given I am logged in
    And I have items in my cart
    When I submit the shipping form with <invalid_case>
    Then I should see the shipping error "<message>"

    Examples:
      | invalid_case      | message                               |
      | missing name      | Name is required.                     |
      | missing address   | Address is required.                  |
      | missing city      | City is required.                     |

  @user @error @xfail-buggy-checkout-1
  Scenario: Invalid ZIP shows an error
    Given I am logged in
    And I have items in my cart
    When I submit the shipping form with an invalid ZIP
    Then I should see the shipping error "Valid 5-digit ZIP code is required."

  @user
  Scenario: Payment step accepts card details
    Given I am logged in
    And I have completed the shipping step
    When I submit valid payment details
    Then I should be on the review step

  @user @error
  Scenario Outline: Payment validation messages
    Given I am logged in
    And I have completed the shipping step
    When I submit the payment form with <invalid_case>
    Then I should see the payment error "<message>"

    Examples:
      | invalid_case      | message                                      |
      | invalid card      | Please enter a valid card number.           |
      | invalid expiry    | Please enter a valid expiry date (MM/YY).   |
      | invalid cvc       | Please enter a valid CVC.                   |

  @user @xfail-buggy-checkout-2
  Scenario: Review total equals the sum of price times quantity
    Given I am logged in
    And I have completed shipping and payment
    When I view the review step
    Then the total should equal the sum of item price times quantity

  @user
  Scenario: Placing an order creates an order confirmation
    Given I am logged in
    And I have completed shipping and payment
    When I place the order
    Then I should see the order confirmation

  @user @xfail-buggy-checkout-3
  Scenario: Order confirmation shows confirmed status
    Given I am logged in
    And I have completed shipping and payment
    When I place the order
    Then the order status should be "confirmed"

  @user @error
  Scenario: Missing checkout session shows an error
    Given I am logged in
    And my checkout session is missing
    When I visit the checkout page
    Then I should see the checkout error "Your checkout session expired. Please start again."

  @user @edge
  Scenario: Empty cart redirects to cart
    Given I am logged in
    And my cart is empty
    When I visit the checkout page
    Then I should see the empty cart message

  @guest @edge
  Scenario: Guests are redirected to login
    Given I am not logged in
    When I visit the checkout page
    Then I should be redirected to the login page
