@api @products
Feature: Products API

  @guest
  Scenario: List products
    When I GET /api/products
    Then the response status should be 200
    And the response should include a product list

  @guest
  Scenario: Search filters products
    When I GET /api/products with search "desk"
    Then the response should include only matching products

  @guest
  Scenario: In-stock filter excludes out-of-stock products
    When I GET /api/products with in_stock "1"
    Then no product in the response should be out of stock

