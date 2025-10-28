# Changelog

All notable changes to keyparty-sdk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2025-01-28

### Added
- **Security**: New `ForbiddenError` class for HTTP 403 responses
- SDK now properly handles child key permission restrictions

### Changed
- **BREAKING (Backend)**: Child keys can no longer call `/api/credits/add` or `/api/credits/set` endpoints
- These operations now return HTTP 403 Forbidden for child keys
- SDK throws `ForbiddenError` when child keys attempt restricted operations
- Only service keys (sk_*) can add or set credits; child keys (ck_pk_*) are restricted to get/deduct

### Security
- **CRITICAL**: Fixed vulnerability where child keys could grant themselves unlimited credits
- Child keys now properly restricted to read (GET) and spend (DEDUCT) operations only

## [0.1.2] - 2025-01-27

### Fixed
- **Error Handling**: Fixed SDK to properly parse JSON error responses with non-200 HTTP status codes (e.g., 402 Payment Required)
- SDK now correctly detects "Insufficient credits" errors and throws `InsufficientCreditsError` instead of timing out
- Maintains proper HTTP semantics: backend returns 402 for insufficient credits, SDK parses error details from response body

### Changed
- Refactored request error handling to always parse JSON body first, regardless of HTTP status code
- Improved error messages for invalid response formats

## [0.1.1] - 2025-01-26

### Added
- Initial public release
- Full TypeScript support with type definitions
- Zero dependencies (uses native Node.js fetch)
- Automatic retry logic with exponential backoff
- Comprehensive error handling with custom error classes
- Service key authentication support
- Child key creation and management
- Credit operations: get, add, deduct, set
- Batch operations support

### Features
- Single API call per operation for optimal performance
- Server-authoritative timestamps
- Flat response format for simplicity
- Support for both service keys (sk_*) and child keys (ck_pk_*)
- Multi-tenant credit management

## [0.1.0] - 2025-01-25

### Added
- Initial development release
- Basic credit management functionality
