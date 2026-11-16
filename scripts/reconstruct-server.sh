#!/bin/bash
# Reconstruct the full fixed server.ts from split parts
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cat "$ROOT/server_part_0.ts.txt" "$ROOT/server_part_1.ts.txt" "$ROOT/server_part_2.ts.txt" > "$ROOT/server.ts"
echo "Reconstructed server.ts ($(wc -c < "$ROOT/server.ts") bytes)"
grep -q "gemini-2.0-flash" "$ROOT/server.ts" && echo "OK: gemini-2.0-flash model present" || echo "WARN: model string missing"
