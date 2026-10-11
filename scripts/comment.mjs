// Posts the summary `formfeed ci preview` wrote on the pull request, or updates the comment an
// earlier run of the action posted there, so a pull request has one preview comment however often
// it is pushed to. No dependencies: it runs on whatever Node.js the workflow set up.
//
//   node comment.mjs <formfeed-preview.md>
//
// GitHub's own environment says where: GITHUB_EVENT_PATH (the pull request), GITHUB_REPOSITORY,
// GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_RUN_ID and GITHUB_TOKEN.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** How the action finds its own comment again: the first line of every comment it writes. */
export const MARKER = '<!-- formfeed-preview -->';

/** GitHub refuses a comment longer than this. */
const LIMIT = 65536;

export class GitHubError extends Error {
  constructor(status, detail) {
    super(`GitHub answered ${status}: ${detail}`);
    this.status = status;
  }
}

/** The comment: the marker, the summary, and where the rendered files are. */
export function commentBody(summary, { runUrl, sha }) {
  const of = sha ? ` for ${sha.slice(0, 7)}` : '';
  const footer = `\n\n---\nThe rendered files are in the artifact **formfeed-preview** of [this run](${runUrl})${of}.`;
  const cut =
    '\n\n… The summary is longer than a comment may be; the whole of it is in the artifact.';
  let text = summary.trim();
  const room = LIMIT - MARKER.length - footer.length - cut.length - 1;
  if (text.length > room) text = text.slice(0, room) + cut;
  return `${MARKER}\n${text}${footer}`;
}

/** Updates the comment an earlier run posted on the pull request, or posts a new one. */
export async function upsertComment({
  api,
  token,
  repository,
  number,
  body,
  fetch: request = globalThis.fetch,
}) {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'formfeed-action',
    'x-github-api-version': '2022-11-28',
  };
  const call = async (method, path, payload) => {
    const res = await request(`${api}${path}`, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    return res.json();
  };

  for (let page = 1; ; page += 1) {
    const comments = await call(
      'GET',
      `/repos/${repository}/issues/${number}/comments?per_page=100&page=${page}`,
    );
    const earlier = comments.find(
      (comment) =>
        typeof comment.body === 'string' && comment.body.startsWith(MARKER),
    );
    if (earlier) {
      await call(
        'PATCH',
        `/repos/${repository}/issues/comments/${earlier.id}`,
        {
          body,
        },
      );
      return { action: 'updated', id: earlier.id };
    }
    if (comments.length < 100) break;
  }
  const created = await call(
    'POST',
    `/repos/${repository}/issues/${number}/comments`,
    { body },
  );
  return { action: 'created', id: created.id };
}

async function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.log(
      '::warning::No preview summary was written, so there is nothing to post',
    );
    return;
  }
  const env = process.env;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const number = event.pull_request?.number;
  if (!number) {
    console.log('Not a pull request: nothing to comment on');
    return;
  }
  const body = commentBody(readFileSync(file, 'utf8'), {
    runUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    sha: event.pull_request.head?.sha,
  });
  try {
    const result = await upsertComment({
      api: env.GITHUB_API_URL ?? 'https://api.github.com',
      token: env.GITHUB_TOKEN,
      repository: env.GITHUB_REPOSITORY,
      number,
      body,
    });
    console.log(`Preview comment ${result.action} (${result.id})`);
  } catch (error) {
    // a pull request from a fork runs with a token that cannot write; the files are still in the
    // artifact, so the preview is not lost
    if (
      error instanceof GitHubError &&
      (error.status === 403 || error.status === 404)
    ) {
      console.log(
        `::warning::The preview could not be posted on the pull request (${error.status}). The job needs \`pull-requests: write\`; the rendered files are in the artifact.`,
      );
      return;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
