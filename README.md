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
      - uses: formfeed-dev/formfeed-action@v1
        with:
          api-key: ${{ secrets.FORMFEED_TEST_KEY }}

      - if: github.event_name == 'push'
        uses: formfeed-dev/formfeed-action@v1
        with:
          api-key: ${{ secrets.FORMFEED_LIVE_KEY }}
          validate: false
          test: false
          publish: true
```

On every run the action:

1. **Validates** every template (`formfeed validate`): its syntax, variables its data does not have, header and footer, partials it includes and the project lacks, and for an invoice template the `_invoice` block of every data set. Offline; no key needed.
2. **Tests** every data set (`formfeed test`): each is compiled and checked, and its output compared with the approved snapshot. Approve the current output with `npx formfeed test -u` and commit the snapshots.
3. **Previews** a pull request: the templates it changes are rendered through the API (`formfeed ci preview`), every template when a shared partial changed. The files are uploaded as the artifact `formfeed-preview`, and the summary, with the page count of every document, is posted on the pull request as one comment that each run updates.
4. **Publishes**, when you ask for it: `formfeed templates push --publish` with the commit as change note, or a push to a release channel.

A step that finds a problem fails the job, with every finding in the log.

## Inputs

| Input               | Default                        | What it does                                                                                                                                    |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-key`           |                                | A Formfeed API key. Validation and tests run without one; previews and publishing need one. A test key (`ff_test_…`) renders previews for free. |
| `working-directory` | `.`                            | The folder of the Formfeed project, the one that holds `formfeed.json`.                                                                         |
| `version`           | the current release            | The version of the `formfeed` command line the steps run.                                                                                       |
| `node-version`      | `22`                           | The Node.js version the command line runs on.                                                                                                   |
| `validate`          | `true`                         | Run `formfeed validate`.                                                                                                                        |
| `test`              | `true`                         | Run `formfeed test` against the approved snapshots.                                                                                             |
| `preview`           | `auto`                         | Render the changed templates. `auto` does it on pull requests when `api-key` is set; `true` and `false` decide it yourself.                     |
| `base`              | the pull request's base branch | The git ref the preview compares against. Set it to preview outside pull requests.                                                              |
| `comment`           | `true`                         | Post the preview's summary on the pull request, updating the action's own comment. Needs `pull-requests: write`.                                |
| `publish`           | `false`                        | Push the templates and publish them. Set it on your default branch only, with a live key that has `template:write`.                             |
| `channel`           |                                | With `publish`, push to this release channel instead of publishing.                                                                             |
| `github-token`      | `${{ github.token }}`          | The token that writes the comment.                                                                                                              |

## Outputs

| Output    | What it is                                             |
| --------- | ------------------------------------------------------ |
| `summary` | The path of `formfeed-preview.md`, when a preview ran. |

## Good to know

- **Keys.** Store them as repository secrets. Use a test key for pull requests: its renders cost nothing and its files are deleted after a day. Give the live key of the publish step only the scopes it needs.
- **Pull requests from forks** run without your secrets, so `auto` skips the preview there; validation and tests still run. A fork's token cannot write comments either, which the action reports as a warning.
- **History.** The preview compares against the base branch, so the action fetches the history it needs; a checkout with `fetch-depth: 0` saves that step.
- **Your project.** `npx formfeed init` creates a project folder, and `npx formfeed init --from-workspace` pulls the templates your workspace has. See the [command line](https://docs.formfeed.dev/cli) and [CI usage](https://docs.formfeed.dev/cli/ci) in the documentation.
- **Release channels.** To try a change before it is live, push to a channel (`channel: staging`) and publish it in a later step; see [release channels](https://docs.formfeed.dev/templates/release-channels).

## License

MIT
