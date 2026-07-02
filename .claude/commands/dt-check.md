Run the full diet-tracker quality check suite.

Execute in order, stopping on the first failure:

```bash
cd ~/diet-tracker

echo "=== TypeScript type check ==="
npx tsc --noEmit

echo "=== ESLint ==="
npm run lint

echo "=== Build ==="
npm run build
```

Report results:
- List any TypeScript errors with file:line
- List any ESLint warnings/errors
- Confirm build success or show build errors

If all pass: "✓ All checks passed"
If any fail: list issues with severity and suggested fix.
