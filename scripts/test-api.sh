#!/bin/bash

BASE_URL="http://localhost:3000"

echo "Testing API endpoints..."

# Health check
echo ""
echo "--- Health Check ---"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"

# Get trees (dev mode — auth is mocked)
echo ""
echo "--- Get Trees Near Austin ---"
curl -s -H "Authorization: Bearer dev-token" "$BASE_URL/api/trees?lat=30.2672&lng=-97.7431&radius=1000" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/trees?lat=30.2672&lng=-97.7431&radius=1000"

# Get user profile
echo ""
echo "--- Get User Profile ---"
curl -s -H "Authorization: Bearer dev-token" "$BASE_URL/api/users/me" | python3 -m json.tool 2>/dev/null || curl -s -H "Authorization: Bearer dev-token" "$BASE_URL/api/users/me"

# Get user stats
echo ""
echo "--- Get User Stats ---"
curl -s -H "Authorization: Bearer dev-token" "$BASE_URL/api/users/me/stats" | python3 -m json.tool 2>/dev/null || curl -s -H "Authorization: Bearer dev-token" "$BASE_URL/api/users/me/stats"

echo ""
echo "--- API Smoke Tests Complete ---"
