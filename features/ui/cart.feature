@ui @cart
Feature: Cart UI

  @user
  Scenario: View cart with items
    Given I am logged in
    And I have items in my cart
    When I visit the cart page
    Then I should see the cart table
    And I should see a cart total

  @user @edge
  Scenario: Quantity below 1 removes the item
    Given I am logged in
    And I have a product in my cart
    When I update the quantity to 0
    Then the item should no longer be in the cart

  @user @edge
  Scenario: Quantity above stock is clamped to stock
    Given I am logged in
    And I have a product in my cart
    When I update the quantity above available stock
    Then the item quantity should be capped at available stock

  @user @xfail-buggy-cart-2
  Scenario: Update quantity recalculates subtotal
    Given I am logged in
    And I have a product in my cart
    When I update the quantity
    Then the item subtotal should update

  @user @xfail-buggy-cart-1
  Scenario: Remove item clears it from cart
    Given I am logged in
    And I have a product in my cart
    When I remove the item from the cart
    Then the item should no longer be in the cart

  @user
  Scenario: Empty cart shows empty state
    Given I am logged in
    And my cart is empty
    When I visit the cart page
    Then I should see "Your cart is empty."

  @guest @edge
  Scenario: Guests are redirected to login
    Given I am not logged in
    When I visit the cart page
    Then I should be redirected to the login page
