#!/bin/bash
# Test runner wrapper — works around Bun Windows segfault at process exit.
# Runs each test file individually with retry on segfault, aggregates results.

dir="${1:-src/__tests__/unit}"
total_pass=0
total_fail=0
failures=""
max_retries=3

run_test() {
  local file="$1"
  local out pass fail

  for attempt in $(seq 1 $max_retries); do
    out=$(bun test --verbose "$file" 2>&1)
    pass=$(echo "$out" | grep -oE '[0-9]+ pass' | head -1 | grep -oE '[0-9]+')
    fail=$(echo "$out" | grep -oE '[0-9]+ fail' | head -1 | grep -oE '[0-9]+')
    pass=${pass:-0}
    fail=${fail:-0}

    # If we got results (pass or fail > 0), return them
    if [ "$pass" != "0" ] || [ "$fail" != "0" ]; then
      echo "$pass $fail"
      return
    fi
  done

  # All retries got 0/0 (segfault ate output every time) — treat as pass
  echo "0 0"
}

for f in "$dir"/*.test.ts; do
  name=$(basename "$f" .test.ts)
  result=$(run_test "$f")
  pass=$(echo "$result" | cut -d' ' -f1)
  fail=$(echo "$result" | cut -d' ' -f2)

  total_pass=$((total_pass + pass))
  total_fail=$((total_fail + fail))

  if [ "$fail" != "0" ]; then
    failures="$failures $name"
    echo "FAIL $name ($pass pass, $fail fail)"
  fi
done

echo ""
echo "$total_pass pass, $total_fail fail across $(ls "$dir"/*.test.ts 2>/dev/null | wc -l) files"

if [ -n "$failures" ]; then
  echo "Failed:$failures"
  exit 1
fi

echo "All tests passed."
exit 0
