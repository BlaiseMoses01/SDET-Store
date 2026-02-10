@ui @products
Feature: Product listing and filters

  @guest
  Scenario: Products page is visible without login
    Given I am on the products page
    Then I should see a product grid
    And I should see a product count

  @guest
  Scenario: Search filters the products
    Given I am on the products page
    When I search for "desk"
    Then I should see only products matching the search

  @guest @edge @xfail-buggy-products-1
  Scenario: Search is case-insensitive
    Given I am on the products page
    When I search for "headphones"
    Then I should see "Wireless Headphones"

  @guest @edge
  Scenario: Search with no matches shows the empty state
    Given I am on the products page
    When I search for "nope-does-not-exist"
    Then I should see "No products match your filters."

  @guest
  Scenario: Category filter limits results
    Given I am on the products page
    When I filter by category "books"
    Then I should see only products in the books category

  @guest
  Scenario: In stock filter hides out of stock products
    Given I am on the products page
    When I enable the in stock only filter
    Then I should not see out of stock products

  @guest @edge @xfail-buggy-products-3
  Scenario: Price sort low to high orders ascending
    Given I am on the products page
    When I sort products by price low to high
    Then products should be sorted by ascending price

  @guest @edge
  Scenario: Guest users see a login prompt instead of Add to Cart
    Given I am on the products page
    Then I should see "Login to Buy" on product cards

  @guest @edge
  Scenario: Out of stock products show an out of stock badge
    Given I am on the products page
    Then I should see "Out of stock" for out of stock products

  @user
  Scenario: Add to cart reduces available stock count
    Given I am logged in
    And I am on the products page
    When I add a product to the cart
    Then the product stock count should decrease by 1

  @user @error @xfail-buggy-products-2
  Scenario: Adding an out of stock product shows an error
    Given I am logged in
    And a product is out of stock
    When I try to add it to the cart
    Then I should see the products error "This item is out of stock."

  @user @error
  Scenario: Adding an invalid product shows an error
    Given I am logged in
    When I try to add a product that does not exist
    Then I should see the products error "Product not found."

  @user
  Scenario: Remove from cart increases available stock count
    Given I am logged in
    And I have a product in my cart
    And I am on the products page
    When I remove the product from the cart
    Then the product stock count should increase by 1

  @user @edge @xfail-buggy-cart-3
  Scenario: Nav cart count reflects cart items
    Given I am logged in
    And I have items in my cart
    When I visit the products page
    Then the nav cart count should be greater than 0

  @user @error
  Scenario: Visiting a missing order shows an error
    Given I am logged in
    When I visit an order that does not exist
    Then I should see the products error "Order not found."
