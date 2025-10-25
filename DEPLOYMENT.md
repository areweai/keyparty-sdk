# KeyParty Node SDK - Deployment Guide

## Prerequisites

1. **npm Account**: Create an account at https://www.npmjs.com
2. **npm CLI**: Ensure you have npm 8.0.0 or higher
3. **Organization Access**: If publishing under `keyparty-sdk` scope, ensure you have publish access to the organization

## Pre-Deployment Checklist

Before publishing, ensure all quality checks pass:

```bash
# 1. Install dependencies
npm install

# 2. Run linting
npm run lint

# 3. Run tests
npm test

# 4. Run tests with coverage
npm test -- --coverage

# 5. Type check
npm run type-check

# 6. Build the package
npm run build
```

**Expected Results:**
- ✅ Linting: 0 errors, 0 warnings
- ✅ Tests: All tests passing
- ✅ Coverage: >95% coverage
- ✅ Type checking: No TypeScript errors
- ✅ Build: Successful compilation to `dist/`

## Version Management

Update the version in `package.json` following semantic versioning:

```bash
# Patch release (bug fixes): 0.1.0 -> 0.1.1
npm version patch

# Minor release (new features, backward compatible): 0.1.0 -> 0.2.0
npm version minor

# Major release (breaking changes): 0.1.0 -> 1.0.0
npm version major
```

This will:
- Update `package.json` version
- Create a git commit with the version change
- Create a git tag

## Publishing to npm

### First-Time Setup

1. **Login to npm:**
```bash
npm login
```

2. **Verify your account:**
```bash
npm whoami
```

### Publishing Process

1. **Dry run (recommended first time):**
```bash
npm publish --dry-run
```

This shows what files will be published without actually publishing.

2. **Publish to npm:**
```bash
# For scoped packages (keyparty-sdk), you must specify access
npm publish --access public
```

**Note:** The `prepublishOnly` script will automatically run `npm run lint && npm test && npm run build` before publishing.

### Verify Publication

1. Check the package page: https://www.npmjs.com/package/keyparty-sdk
2. Test installation in a separate project:

```bash
mkdir test-install
cd test-install
npm init -y
npm install keyparty-sdk
```

3. Test basic functionality:

```javascript
// test.js
import { KeyPartyClient } from 'keyparty-sdk';

const client = new KeyPartyClient('sk_test_key');
console.log('SDK imported successfully!');
```

## Post-Deployment

### Update Documentation

1. Update README.md with installation instructions
2. Add changelog entry for the new version
3. Update any examples or guides

### Git Workflow

1. **Push version tags:**
```bash
git push origin main --tags
```

2. **Create GitHub release** (optional but recommended):
   - Go to GitHub repository releases
   - Create a new release from the version tag
   - Add release notes describing changes

## Troubleshooting

### Error: "You do not have permission to publish"

**Solution:** Ensure you're logged in with the correct npm account and have access to the `keyparty-sdk` organization:

```bash
npm whoami
npm org ls keyparty
```

### Error: "Cannot publish over existing version"

**Solution:** The version already exists on npm. Update the version:

```bash
npm version patch
npm publish --access public
```

### Error: "Package name too similar to existing package"

**Solution:** Scoped packages (`keyparty-sdk/`) help avoid naming conflicts. Ensure you're publishing with the correct scope.

### Build Fails During Publish

**Solution:** The `prepublishOnly` script runs automatically. If it fails:

1. Run `npm run build` manually to see the error
2. Fix TypeScript errors
3. Ensure all tests pass with `npm test`
4. Try publishing again

## Unpublishing (Emergency Only)

⚠️ **Warning:** Unpublishing is discouraged and may be blocked by npm after 72 hours.

```bash
# Unpublish a specific version
npm unpublish keyparty-sdk@0.1.0

# Unpublish entire package (use with extreme caution)
npm unpublish keyparty-sdk --force
```

**Alternative:** Publish a new patch version with fixes instead of unpublishing.

## Automated Publishing (CI/CD)

For automated publishing via GitHub Actions or other CI/CD:

1. **Generate npm token:**
```bash
npm token create --read-only=false
```

2. **Add token to GitHub Secrets:**
   - Repository Settings → Secrets → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm token

3. **Create workflow** (`.github/workflows/publish.yml`):

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Package Files Published

The following files are included in the published package (configured via `files` in package.json and `.npmignore`):

**Included:**
- `dist/` - Compiled JavaScript and TypeScript declarations
- `README.md` - Package documentation
- `LICENSE` - License file
- `package.json` - Package metadata

**Excluded:**
- `src/` - TypeScript source files
- `__tests__/` - Test files
- `tsconfig.json`, `vitest.config.ts` - Configuration files
- `node_modules/`, `.vscode/` - Development artifacts

## Support

For issues with deployment:
- Check npm status: https://status.npmjs.org
- npm documentation: https://docs.npmjs.com
- GitHub issues: https://github.com/areweai/keyparty-sdk/issues
