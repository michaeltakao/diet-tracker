Auto-fix common diet-tracker lint and format issues.

Run:
```bash
cd ~/diet-tracker
npx prettier --write "**/*.{ts,tsx,js,json}" --ignore-path .gitignore 2>/dev/null
npm run lint -- --fix 2>/dev/null
```

Then report:
- Files reformatted by prettier
- ESLint auto-fixes applied
- Any remaining issues that require manual intervention (list with file:line)
