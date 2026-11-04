#!/usr/bin/env node
/**
 * Gate do AI review.
 *
 * Recebe o JSON estruturado produzido pelo Claude Code Action e:
 *  - publica/atualiza um comentário-resumo no PR;
 *  - tenta publicar comentários inline nos achados bloqueantes;
 *  - falha o check quando existe finding `blocker` ou `major`.
 *
 * O check `AI review` é obrigatório no ruleset; este script é o que transforma
 * o parecer do modelo em bloqueio de merge. Nenhum comentário é tratado como
 * aprovação: quem libera o merge são os checks verdes.
 */

import { createHash } from 'node:crypto';

const {
  GH_TOKEN,
  GITHUB_REPOSITORY: repo,
  PR_NUMBER: prNumber,
  HEAD_SHA: headSha,
  REVIEW_RESULT: reviewResult,
  REVIEW_JSON: reviewJson,
  PR_DRAFT: prDraft,
} = process.env;

const MARKER = '<!-- ai-review-gate -->';
const MAX_FINDINGS = 40;
const MAX_INLINE = 20;
const MAX_BODY = 900;

const pr = Number(prNumber);

function log(message) {
  console.log(message);
}

function failHard(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!GH_TOKEN || !repo || !Number.isInteger(pr) || pr <= 0) {
  failHard('AI review gate: GH_TOKEN, GITHUB_REPOSITORY e PR_NUMBER são obrigatórios.');
  process.exit(1);
}

async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

function truncate(value, limit = MAX_BODY) {
  const text = String(value ?? '').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function severityRank(severity) {
  return { blocker: 0, major: 1, minor: 2, nit: 3 }[severity] ?? 4;
}

function normalizeFindings(raw) {
  if (!Array.isArray(raw)) {
    return null;
  }

  return raw
    .filter((finding) => finding && typeof finding === 'object')
    .map((finding) => {
      const severity = String(finding.severity ?? '').toLowerCase();
      if (!['blocker', 'major', 'minor', 'nit'].includes(severity)) {
        return null;
      }
      if (typeof finding.file !== 'string' || finding.file.trim() === '') {
        return null;
      }
      if (typeof finding.title !== 'string' || finding.title.trim() === '') {
        return null;
      }

      const line = Number(finding.line);
      return {
        severity,
        file: finding.file.trim(),
        line: Number.isInteger(line) && line > 0 ? line : null,
        title: truncate(finding.title, 180),
        body: truncate(finding.body),
        suggestion: truncate(finding.suggestion, 600),
      };
    })
    .filter(Boolean)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, MAX_FINDINGS);
}

function findingLine(finding) {
  return finding.line ? `\`${finding.file}:${finding.line}\`` : `\`${finding.file}\``;
}

function renderFinding(finding, index) {
  const lines = [
    `${index + 1}. **[${finding.severity}]** ${findingLine(finding)} — ${finding.title}`,
  ];
  if (finding.body) {
    lines.push(...finding.body.split('\n').map((line) => `   ${line}`));
  }
  if (finding.suggestion) {
    lines.push(`   **Sugestão:** ${finding.suggestion}`);
  }
  return lines.join('\n');
}

function renderSummary({ status, review, findings, note }) {
  const blocking = findings.filter((finding) => finding.severity === 'blocker' || finding.severity === 'major');
  const advisory = findings.filter((finding) => finding.severity === 'minor' || finding.severity === 'nit');

  const lines = [
    MARKER,
    `## ${status} — AI review`,
    '',
    `**Commit:** \`${headSha ? headSha.slice(0, 7) : '?'}\``,
  ];

  if (review?.verdict) {
    lines.push(`**Veredito:** \`${review.verdict}\``);
  }

  if (note) {
    lines.push('', note);
  }

  if (review?.summary) {
    lines.push('', truncate(review.summary, 1200));
  }

  lines.push('');

  if (findings.length === 0) {
    lines.push('Nenhum achado bloqueante encontrado.');
  } else if (blocking.length > 0) {
    lines.push(`### Bloqueantes (${blocking.length})`, '');
    lines.push(blocking.map((finding, index) => renderFinding(finding, index)).join('\n\n'));
  }

  if (advisory.length > 0) {
    lines.push('', '<details>', `<summary>Achados não bloqueantes (${advisory.length})</summary>`, '');
    lines.push(advisory.map((finding, index) => renderFinding(finding, index)).join('\n\n'));
    lines.push('', '</details>');
  }

  if (blocking.length > 0) {
    lines.push(
      '',
      '---',
      'Para pedir a correção automática, aplique a label **`ai:fix`** neste PR.',
      'O Claude corrige, roda lint/typecheck/Jest e dá push; Quality, Playwright e AI review rodam de novo.',
    );
  }

  lines.push(
    '',
    '<sub>Review automático por IA. Ele não substitui os testes nem a revisão humana do diff.</sub>',
  );

  return lines.join('\n');
}

async function upsertSummary(body) {
  try {
    const { response, data } = await api(`/repos/${repo}/issues/${pr}/comments?per_page=100`);
    if (!response.ok || !Array.isArray(data)) {
      log(`::warning::Não foi possível listar comentários do PR (${response.status}).`);
      return;
    }

    const existing = data.find(
      (comment) => typeof comment.body === 'string'
        && comment.body.includes(MARKER)
        && comment.user?.type === 'Bot',
    );

    if (existing) {
      const update = await api(`/repos/${repo}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      });
      if (!update.response.ok) {
        log(`::warning::Não foi possível atualizar o comentário do gate (${update.response.status}).`);
      }
      return;
    }

    const create = await api(`/repos/${repo}/issues/${pr}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    if (!create.response.ok) {
      log(`::warning::Não foi possível publicar o comentário do gate (${create.response.status}).`);
    }
  } catch (error) {
    log(`::warning::Falha ao publicar o resumo do review: ${error instanceof Error ? error.message : error}`);
  }
}

function inlineBody(finding) {
  const parts = [`**[${finding.severity}]** ${finding.title}`];
  if (finding.body) {
    parts.push('', finding.body);
  }
  if (finding.suggestion) {
    parts.push('', `**Sugestão:** ${finding.suggestion}`);
  }
  return truncate(parts.join('\n'), 1200);
}

function bodyHash(body) {
  return createHash('sha256').update(body).digest('hex').slice(0, 12);
}

async function postInlineReview(findings) {
  if (!headSha) {
    return;
  }

  const candidates = findings
    .filter((finding) => finding.severity === 'blocker' || finding.severity === 'major')
    .filter((finding) => typeof finding.file === 'string' && finding.line)
    .slice(0, MAX_INLINE);

  if (candidates.length === 0) {
    return;
  }

  try {
    const existingResponse = await api(`/repos/${repo}/pulls/${pr}/comments?per_page=100`);
    const existing = new Set();
    if (existingResponse.response.ok && Array.isArray(existingResponse.data)) {
      for (const comment of existingResponse.data) {
        if (comment?.path && Number.isInteger(comment?.line)) {
          existing.add(`${comment.path}:${comment.line}:${bodyHash(comment.body ?? '')}`);
        }
      }
    }

    const comments = [];
    for (const finding of candidates) {
      const body = inlineBody(finding);
      const key = `${finding.file}:${finding.line}:${bodyHash(body)}`;
      if (existing.has(key)) {
        continue;
      }
      comments.push({
        path: finding.file,
        line: finding.line,
        side: 'RIGHT',
        body,
      });
    }

    if (comments.length === 0) {
      return;
    }

    const result = await api(`/repos/${repo}/pulls/${pr}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        commit_id: headSha,
        event: 'COMMENT',
        body: `${MARKER}\nAchados bloqueantes do AI review. O check permanece vermelho até a correção e um novo review.`,
        comments,
      }),
    });

    if (!result.response.ok) {
      log(`::warning::Comentários inline não publicados (${result.response.status}); o resumo continua no comentário do PR.`);
    }
  } catch (error) {
    log(`::warning::Falha ao publicar comentários inline: ${error instanceof Error ? error.message : error}`);
  }
}

async function hasSkipLabel() {
  try {
    const { response, data } = await api(`/repos/${repo}/issues/${pr}/labels?per_page=100`);
    return response.ok && Array.isArray(data) && data.some((label) => label.name === 'ai-review:skip');
  } catch {
    return false;
  }
}

async function main() {
  if (await hasSkipLabel()) {
    const body = renderSummary({
      status: '⏭️ Ignorado',
      findings: [],
      note: 'A label **`ai-review:skip`** foi aplicada por uma pessoa com acesso ao repositório. Remova a label e reexecute este check para revisar de novo.',
    });
    await upsertSummary(body);
    log('AI review ignorado pela label ai-review:skip.');
    return;
  }

  if (reviewResult === 'skipped') {
    if (prDraft === 'true') {
      const body = renderSummary({
        status: '⏳ Aguardando',
        findings: [],
        note: 'O PR está em draft. O AI review roda automaticamente quando ele for marcado como pronto para revisão.',
      });
      await upsertSummary(body);
      log('PR em draft; review adiado.');
      return;
    }

    await upsertSummary(renderSummary({
      status: '⚠️ Não executado',
      findings: [],
      note: `O job de review terminou como \`${reviewResult}\` sem produzir um parecer. Reexecute o check ou verifique o secret \`CLAUDE_CODE_OAUTH_TOKEN\` e a instalação do Claude GitHub App.`,
    }));
    failHard('AI review não foi executado.');
    return;
  }

  if (reviewResult !== 'success') {
    await upsertSummary(renderSummary({
      status: '⚠️ Falhou',
      findings: [],
      note: `O job de review terminou como \`${reviewResult}\`. O merge fica bloqueado até um review válido. Verifique os logs do workflow e, se necessário, reexecute o check.`,
    }));
    failHard(`AI review terminou como ${reviewResult}.`);
    return;
  }

  let review;
  try {
    review = JSON.parse(reviewJson ?? '');
  } catch {
    await upsertSummary(renderSummary({
      status: '⚠️ Inválido',
      findings: [],
      note: 'O review não retornou um JSON válido no schema esperado. Reexecute o check.',
    }));
    failHard('AI review retornou JSON inválido.');
    return;
  }

  const findings = normalizeFindings(review?.findings);
  if (!findings || (findings.length === 0 && Array.isArray(review?.findings) && review.findings.length > 0)) {
    await upsertSummary(renderSummary({
      status: '⚠️ Inválido',
      findings: [],
      note: 'O review não retornou a lista `findings` no schema esperado. Reexecute o check.',
    }));
    failHard('AI review retornou findings inválidos.');
    return;
  }

  const blocking = findings.filter((finding) => finding.severity === 'blocker' || finding.severity === 'major');
  const approved = blocking.length === 0;

  const body = renderSummary({
    status: approved ? '✅ Aprovado' : '❌ Bloqueado',
    review,
    findings,
    note: approved
      ? 'Nenhum achado bloqueante. O merge continua sujeito a Quality, Playwright e aos demais checks obrigatórios.'
      : `${blocking.length} achado(s) bloqueante(s). O merge fica bloqueado até a correção e um novo AI review.`,
  });

  await upsertSummary(body);
  await postInlineReview(findings);

  log(`AI review: ${findings.length} achado(s), ${blocking.length} bloqueante(s).`);
  if (!approved) {
    process.exitCode = 1;
  }
}

await main();
