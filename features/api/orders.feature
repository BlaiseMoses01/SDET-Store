@api @orders
Feature: Orders API

  @user
  Scenario: Create an order with an idempotency key
    Given I am authenticated via the API
    And I have items in my cart
    When I POST to /api/orders with a valid payload and idempotency key
    Then the response status should be 201
    And the response should include the order summary

  @guest @error
  Scenario: Create an order without auth is rejected
    Given I am not authenticated
    When I POST to /api/orders with a valid payload
    Then the response status should be 401
    And the error should be "unauthorized"

  @user @error
  Scenario: Missing idempotency key is rejected
    Given I am authenticated via the API
    When I POST to /api/orders without an Idempotency-Key
    Then the response status should be 400
    And the error should be "missing_idempotency_key"

  @user @error
  Scenario Outline: Order validation errors
    Given I am authenticated via the API
    And I have items in my cart
    When I POST to /api/orders with <invalid_case>
    Then the response status should be 400
    And the error should be "validation_error"
    And the error details should include "<detail>"

    Examples:
      | invalid_case              | detail                         |
      | missing shipping_name     | shipping_name is required      |
      | missing shipping_address  | shipping_address is required   |
      | missing shipping_city     | shipping_city is required      |
      | missing shipping_zip      | shipping_zip is required       |
      | invalid payment_last4     | payment_last4 must be 4 digits |

  @user @error
  Scenario: Order with empty cart is rejected
    Given I am authenticated via the API
    And my cart is empty
    When I POST to /api/orders with a valid payload and idempotency key
    Then the response status should be 400
    And the error should be "cart_empty"

  @user @error
  Scenario: Missing order summary returns not found
    Given I am authenticated via the API
    And an order is created then removed from storage
    When I POST to /api/orders with a valid payload and idempotency key
    Then the response status should be 404
    And the error should be "order_not_found"

  @user @xfail-buggy-api-orders-1
  Scenario: Replaying the same idempotency key returns the same order
    Given I am authenticated via the API
    And I have already created an order with idempotency key "demo-123"
    When I POST to /api/orders with idempotency key "demo-123"
    Then the response status should be 200
    And the response should indicate the order was replayed
