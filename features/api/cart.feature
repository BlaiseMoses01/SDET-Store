@api @cart
Feature: Cart API

  @user
  Scenario: Add item to cart
    Given I am authenticated via the API
    When I POST to /api/cart/items with a product id
    Then the response status should be 201
    And the cart count should increase

  @guest @error
  Scenario: Add item without auth is rejected
    Given I am not authenticated
    When I POST to /api/cart/items with a product id
    Then the response status should be 401
    And the error should be "unauthorized"

  @user @error
  Scenario Outline: Add item validation errors
    Given I am authenticated via the API
    When I POST to /api/cart/items with <invalid_case>
    Then the response status should be 400
    And the error should be "invalid_request"

    Examples:
      | invalid_case          |
      | missing product_id    |
      | non-numeric product_id|
      | quantity less than 1  |

  @user @error
  Scenario: Add item for unknown product
    Given I am authenticated via the API
    When I POST to /api/cart/items with a nonexistent product id
    Then the response status should be 404
    And the error should be "product_not_found"

  @user @error @xfail-buggy-api-cart-1
  Scenario: Add item that is out of stock
    Given I am authenticated via the API
    And a product is out of stock
    When I POST to /api/cart/items for that product
    Then the response status should be 409
    And the error should be "out_of_stock"

  @user
  Scenario: Update item quantity
    Given I am authenticated via the API
    And I have a cart item
    When I PATCH /api/cart/items/:id with quantity 2
    Then the response should include the updated quantity

  @user @edge
  Scenario: Update quantity to 0 removes the item
    Given I am authenticated via the API
    And I have a cart item
    When I PATCH /api/cart/items/:id with quantity 0
    Then the response should indicate the item was removed

  @user @edge @xfail-buggy-api-cart-1
  Scenario: Update quantity above stock is clamped
    Given I am authenticated via the API
    And I have a cart item
    When I PATCH /api/cart/items/:id with quantity above stock
    Then the response should include the clamped quantity

  @user @error
  Scenario: Update item without auth is rejected
    Given I am not authenticated
    When I PATCH /api/cart/items/:id
    Then the response status should be 401
    And the error should be "unauthorized"

  @user @error
  Scenario: Update item with invalid request
    Given I am authenticated via the API
    When I PATCH /api/cart/items/:id with an invalid body
    Then the response status should be 400
    And the error should be "invalid_request"

  @user @error
  Scenario: Update item with invalid id
    Given I am authenticated via the API
    When I PATCH /api/cart/items/invalid with a valid body
    Then the response status should be 400
    And the error should be "invalid_request"

  @user @error
  Scenario: Update item that does not exist
    Given I am authenticated via the API
    When I PATCH /api/cart/items/:id for a missing cart item
    Then the response status should be 404
    And the error should be "cart_item_not_found"

  @user
  Scenario: Remove item from cart
    Given I am authenticated via the API
    And I have a cart item
    When I DELETE /api/cart/items/:id
    Then the item should be removed from the cart

  @user @error
  Scenario: Delete item with invalid id
    Given I am authenticated via the API
    When I DELETE /api/cart/items/invalid
    Then the response status should be 400
    And the error should be "invalid_request"

  @user @error
  Scenario: Delete item that does not exist
    Given I am authenticated via the API
    When I DELETE /api/cart/items/:id for a missing cart item
    Then the response status should be 404
    And the error should be "cart_item_not_found"
