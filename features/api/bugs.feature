@api @bugs
Feature: API bug modes

  @bug @mode-buggy-api-auth-1
  Scenario: API allows access without a session
    Given APP_MODE is "buggy-api-auth-1"
    When I GET /api/me without authentication
    Then the response status should be 200
    And the response should include a user profile

  @bug @mode-buggy-api-auth-2
  Scenario: API login accepts any password for existing users
    Given APP_MODE is "buggy-api-auth-2"
    When I POST to /api/login with a valid email and wrong password
    Then the response status should be 200
    And a session cookie should be set

  @bug @mode-buggy-api-products-1
  Scenario: API in_stock filter is ignored
    Given APP_MODE is "buggy-api-products-1"
    When I GET /api/products with in_stock "1"
    Then the response may include out of stock products

  @bug @mode-buggy-api-cart-1
  Scenario: API allows adding out of stock items
    Given APP_MODE is "buggy-api-cart-1"
    And I am authenticated via the API
    And a product is out of stock
    When I POST to /api/cart/items for that product
    Then the response status should be 201

  @bug @mode-buggy-api-cart-1
  Scenario: API allows cart quantity beyond stock
    Given APP_MODE is "buggy-api-cart-1"
    And I am authenticated via the API
    And I have a product in my cart
    When I PATCH /api/cart/items/:id with quantity above stock
    Then the response should include the higher quantity

  @bug @mode-buggy-api-orders-1
  Scenario: API ignores idempotency keys
    Given APP_MODE is "buggy-api-orders-1"
    And I am authenticated via the API
    And I have items in my cart
    When I POST to /api/orders twice with the same idempotency key
    Then both responses should be 201
    And the order ids should be different

  @bug @mode-buggy-api-flaky-1
  Scenario: API flaky attempts are global
    Given APP_MODE is "buggy-api-flaky-1"
    And I have two different client ids
    When client A triggers /api/flaky until success
    Then client B should not see failures
