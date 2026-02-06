@ui @bugs
Feature: UI bug modes

  @bug @mode-buggy-auth-1
  Scenario: Login accepts any password for Alice
    Given APP_MODE is "buggy-auth-1"
    When I submit the login form for "alice@example.com" with a wrong password
    Then I should be redirected to the products page

  @bug @mode-buggy-auth-2
  Scenario: Signup allows duplicate emails
    Given APP_MODE is "buggy-auth-2"
    When I submit the sign up form with an email that already exists
    Then the signup should succeed

  @bug @mode-buggy-auth-3
  Scenario: Expired sessions still work
    Given APP_MODE is "buggy-auth-3"
    And I have an expired session cookie
    When I visit the products page
    Then I should be treated as logged in

  @bug @mode-buggy-products-1
  Scenario: Search is case-sensitive
    Given APP_MODE is "buggy-products-1"
    When I search for "headphones"
    Then I should not see "Wireless Headphones"

  @bug @mode-buggy-products-2
  Scenario: Out of stock items can be added
    Given APP_MODE is "buggy-products-2"
    And I am logged in
    And a product is out of stock
    When I add it to the cart
    Then the product should be added to the cart

  @bug @mode-buggy-products-3
  Scenario: Price sort order is inverted
    Given APP_MODE is "buggy-products-3"
    When I sort products by price low to high
    Then the results should be in descending price order

  @bug @mode-buggy-cart-1
  Scenario: Remove does not remove items
    Given APP_MODE is "buggy-cart-1"
    And I am logged in
    And I have a product in my cart
    When I remove the item from the cart
    Then the item should still be in the cart

  @bug @mode-buggy-cart-2
  Scenario: Subtotal ignores quantity
    Given APP_MODE is "buggy-cart-2"
    And I am logged in
    And I have a cart item with quantity 2
    When I view the cart page
    Then the item subtotal should equal the unit price

  @bug @mode-buggy-cart-3
  Scenario: Nav cart count is always 0
    Given APP_MODE is "buggy-cart-3"
    And I am logged in
    And I have items in my cart
    When I visit the products page
    Then the nav cart count should be "0"

  @bug @mode-buggy-checkout-1
  Scenario: ZIP validation is skipped
    Given APP_MODE is "buggy-checkout-1"
    And I am logged in
    And I have items in my cart
    When I submit the shipping form with an invalid ZIP
    Then I should proceed to the payment step

  @bug @mode-buggy-checkout-2
  Scenario: Order total ignores quantity
    Given APP_MODE is "buggy-checkout-2"
    And I am logged in
    And I have items in my cart with quantities > 1
    When I review the order
    Then the total should equal the sum of unit prices only

  @bug @mode-buggy-checkout-3
  Scenario: Order confirmation shows wrong status
    Given APP_MODE is "buggy-checkout-3"
    And I am logged in
    And I place an order
    When I view the order confirmation
    Then the order status should be "pending"
