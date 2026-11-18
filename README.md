# Formfeed templates

Validate and test your [Formfeed](https://formfeed.dev/?utm_source=github-action) document templates on every push, see the templates a pull request changes rendered before you merge it, and publish them from your default branch. Formfeed renders PDFs and images from HTML, Word and PowerPoint templates through an API; this action runs its command line, `formfeed`, in your workflow.

## Usage

```yaml
name: Templates
on:
  pull_request:
    paths: ['templates/**', 'partials/**']
  push:
    branches: [main]
    paths: ['templates/**', 'partials/**']

jobs:
  templates:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # for the preview comment
    steps:
      - uses: actions/checkout@v4
      - uses: formfeed-dev/formfeed-action@v2
        with:
          api-key: ${{ secrets.FORMFEED_TEST_KEY }}

      - if: github.event_name == 'push'
        uses: formfeed-dev/formfeed-action@v2
        with:
          api-key: ${{ secrets.FORMFEED_LIVE_KEY }}
          validate: false
          test: false
          publish: true
```

On every run the action:

1. **Validates** every template (`formfeed validate`): its syntax, variables its data does not have, header and footer, partials it includes and the project lacks, and for an invoice template the `_invoice` block of every data set. Offline; no key needed.
2. **Tests** every data set (`formfeed test`): each is compiled and checked, and its output compared with the approved snapshot. Approve the current output with `npx formfeed test -u` and commit the snapshots.
3. **Previews** a pull request: the templates it changes are rendered through the API (`formfeed ci preview`) with every data set, every template when a shared partial changed. With a test key each data set is rendered on the base branch too, and the job fails when a page count changed: a table row that moved to a second page shows in the pull request, not in production. The files are uploaded as the artifact `formfeed-preview`, and the summary, with the page counts of the branch and the base, is posted on the pull request as one comment that each run updates.
4. **Publishes**, when you ask for it: `formfeed templates push --publish` with the commit as change note, or a push to a release channel.

A step that finds a problem fails the job, with every finding in the log.

## Inputs

| Input                 | Default                        | What it does                                                                                                                                    |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-key`             |                                | A Formfeed API key. Validation and tests run without one; previews and publishing need one. A test key (`ff_test_…`) renders previews for free. |
| `working-directory`   | `.`                            | The folder of the Formfeed project, the one that holds `formfeed.json`.                                                                         |
| `version`             | the current release            | The version of the `formfeed` command line the steps run.                                                                                       |
| `node-version`        | `22`                           | The Node.js version the command line runs on.                                                                                                   |
| `validate`            | `true`                         | Run `formfeed validate`.                                                                                                                        |
| `test`                | `true`                         | Run `formfeed test` against the approved snapshots.                                                                                             |
| `preview`             | `auto`                         | Render the changed templates. `auto` does it on pull requests when `api-key` is set; `true` and `false` decide it yourself.                     |
| `base`                | the pull request's base branch | The git ref the preview compares against. Set it to preview outside pull requests.                                                              |
| `data-sets`           | `all`                          | Which data sets the preview renders: `all`, `default` (each template's default data set) or names separated by commas.                          |
| `compare`             | `auto`                         | Render each data set on the base branch too and compare the page counts. `auto` does it with a test key; `true` and `false` decide it yourself. |
| `fail-on-page-change` | `true`                         | With `compare`, fail the job when a data set's page count differs from the base branch's.                                                       |
| `page-change-label`   | `pages-changed`                | While the pull request carries this label, a changed page count is reported and does not fail.                                                  |
| `comment`             | `true`                         | Post the preview's summary on the pull request, updating the action's own comment. Needs `pull-requests: write`.                                |
| `publish`             | `false`                        | Push the templates and publish them. Set it on your default branch only, with a live key that has `template:write`.                             |
| `channel`             |                                | With `publish`, push to this release channel instead of publishing.                                                                             |
| `github-token`        | `${{ github.token }}`          | The token that writes the comment.                                                                                                              |

## Outputs

| Output          | What it is                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `summary`       | The path of `formfeed-preview.md`, when a preview ran.                                             |
| `pages-changed` | How many data sets changed their page count against the base branch, when a preview compared them. |

## Good to know

- **Keys.** Store them as repository secrets. Use a test key for pull requests: its renders cost nothing and its files are deleted after a day. Give the live key of the publish step only the scopes it needs.
- **Pull requests from forks** run without your secrets, so `auto` skips the preview there; validation and tests still run. A fork's token cannot write comments either, which the action reports as a warning.
- **History.** The preview compares against the base branch, so the action fetches the history it needs; a checkout with `fetch-depth: 0` saves that step.
- **A page count that was meant to change.** Add the label `pages-changed` (or the one `page-change-label` names) to the pull request: the preview still shows the change, and the job passes. For the label to take effect without a new push, let the workflow run when labels change: `pull_request: { types: [opened, synchronize, reopened, labeled, unlabeled] }`.
- **What a page count does not catch.** A row that moves to the next page without changing the number of pages; the PDFs of both branches are linked in the comment for a look.
- **Costs.** Comparing renders every data set twice. With a test key that costs nothing; with a live key, `compare: auto` does not compare, and `compare: true` counts the units of both renders.
- **Your project.** `npx formfeed init` creates a project folder, and `npx formfeed init --from-workspace` pulls the templates your workspace has. See the [command line](https://docs.formfeed.dev/cli) and [CI usage](https://docs.formfeed.dev/cli/ci) in the documentation.
- **Release channels.** To try a change before it is live, push to a channel (`channel: staging`) and publish it in a later step; see [release channels](https://docs.formfeed.dev/templates/release-channels).
- **Versions.** `@v2` renders every data set and, with a test key, fails a pull request whose page counts changed. `@v1` stays on `v1.0.0`, which renders each template's default data set and compares nothing; to keep its previews on `@v2`, set `data-sets: default` and `compare: false`.

## License

MIT
