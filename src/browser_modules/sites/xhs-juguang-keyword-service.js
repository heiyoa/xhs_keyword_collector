import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { BrowserModuleError } from "../core/browser-errors.js";
import { BrowserResourceService } from "../core/browser-resource-service.js";
import { RoxyApiClient } from "../core/roxy-client.js";
import { openDatabase, nowIso } from "../db/sqlite.js";

const DEFAULT_TARGET_URL = "https://ad.xiaohongshu.com/aurora/ad/tools/newKeywordTool";
const OUTPUT_ROOT = path.resolve("artifacts", "run-evidence", "xhs-juguang-keyword-volume");

export class XhsJuguangKeywordService {
  constructor({
    db = openDatabase(),
    bindingService = new BindingService({
      db,
      credentialResolver: new CredentialResolver(),
    }),
    credentialResolver = new CredentialResolver(),
  } = {}) {
    this.db = db;
    this.bindingService = bindingService;
    this.credentialResolver = credentialResolver;
  }

  async run({ bindingKey, runKey, taskPayload }) {
    const payload = normalizeTaskPayload(taskPayload);
    const startedAt = nowIso();
    const runId = this.#startRun({
      runKey,
      bindingKey,
      scriptName: "xhs-juguang-keyword-volume",
      machineRole: "local",
      startedAt,
    });

    try {
      const result = await this.#execute(bindingKey, runKey, payload);
      this.#finishRun({
        runId,
        status: result.status === "ok" ? "success" : "failed",
        finishedAt: nowIso(),
        resultJson: result,
      });
      return result;
    } catch (error) {
      this.#finishRun({
        runId,
        status: "failed",
        finishedAt: nowIso(),
        errorText: error?.message || String(error),
      });
      throw error;
    }
  }

  async #execute(bindingKey, runKey, payload) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    if (binding.profile.platform !== "xiaohongshu") {
      throw new BrowserModuleError(`Binding ${bindingKey} is not xiaohongshu`, {
        platform: binding.profile.platform,
      });
    }
    if (!binding.profile.current_dir_id) {
      throw new BrowserModuleError(`Binding ${bindingKey} does not have an open current_dir_id. Open the logged-in Juguang window first.`);
    }

    const browserService = this.#createBrowserService(binding);
    const connection = await browserService.getConnectionInfo([binding.profile.current_dir_id]);
    const session = (connection?.data || []).find((item) => item.dirId === binding.profile.current_dir_id);
    if (!session?.ws) {
      throw new BrowserModuleError(`Current window ${binding.profile.current_dir_id} is not open. Please reopen the logged-in Juguang window first.`);
    }

    const browser = await chromium.connectOverCDP(session.ws);
    try {
      const context = browser.contexts()[0];
      const capturedAt = nowIso();
      const results = [];

      for (const keyword of payload.keywords) {
        const row = await queryKeyword(context, keyword);
        results.push({
          keyword,
          search_volume: row?.monthly_search_index_display || null,
          search_volume_field: "monthly_search_index",
          captured_at: capturedAt,
          source_round: payload.source_round,
          source_platform: "xiaohongshu_juguang",
          exact_match: Boolean(row?.exact_match),
          recommendation_reason: row?.recommend_reason || null,
          competition_index: row?.competition_index || null,
          market_bid: row?.market_bid || null,
          matched_keyword: row?.keyword || null,
          raw_month_search_index: row?.monthly_search_index_raw ?? null,
        });
        await sleep(payload.delay_ms);
      }

      const output = await writeOutputs({
        bindingKey,
        runKey,
        sourceRound: payload.source_round,
        results,
      });

      const result = {
        status: "ok",
        binding_key: bindingKey,
        run_key: runKey,
        source_round: payload.source_round,
        target_url: DEFAULT_TARGET_URL,
        keyword_count: results.length,
        results,
        output,
      };

      this.bindingService.updateBindingVerifyResult(bindingKey, {
        type: "xhs-juguang-keyword-volume",
        checkedAt: capturedAt,
        result: {
          keyword_count: results.length,
          output_json: output.json_path,
          output_csv: output.csv_path,
        },
      });

      return result;
    } finally {
      await browser.close();
    }
  }

  #createBrowserService(binding) {
    const apiKey =
      binding.api_credential.resolved_api_key ||
      this.credentialResolver.resolve(binding.api_credential.api_key_ref);
    const client = new RoxyApiClient({
      host: binding.api_credential.api_host,
      token: apiKey,
    });
    return new BrowserResourceService(client);
  }

  #startRun({ runKey, bindingKey, scriptName, machineRole, startedAt }) {
    const binding = this.db.prepare("SELECT id FROM bindings WHERE binding_key = ?").get(bindingKey);
    if (!binding) {
      throw new BrowserModuleError(`Binding not found for run: ${bindingKey}`);
    }

    this.db.prepare(`
      INSERT INTO runs (
        run_key, binding_id, script_name, machine_role, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(runKey, binding.id, scriptName, machineRole, "running", startedAt);

    return this.db.prepare("SELECT id FROM runs WHERE run_key = ?").get(runKey)?.id;
  }

  #finishRun({ runId, status, finishedAt, resultJson, errorText }) {
    this.db.prepare(`
      UPDATE runs
      SET status = ?, finished_at = ?, result_json = ?, error_text = ?
      WHERE id = ?
    `).run(
      status,
      finishedAt,
      resultJson ? JSON.stringify(resultJson) : null,
      errorText || null,
      runId,
    );
  }
}

async function queryKeyword(context, keyword) {
  const page = await context.newPage();
  try {
    await page.goto(DEFAULT_TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(3500);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/keyword/common/recommend") && resp.status() === 200,
      { timeout: 20000 },
    );

    await page.locator(".search-keyword-header .d-select").click();
    await page.keyboard.insertText(keyword);
    await page.keyboard.press("Enter");

    const resp = await responsePromise;
    const json = await resp.json();
    const rows = (json?.data?.wordList || []).map((row) => ({
      keyword: row.keyword || null,
      recommend_reason: mapRecommendReason(row.source, row.recommendReason),
      competition_index: row.competitionLevel || null,
      monthly_search_index_raw: row.monthpv,
      monthly_search_index_display: formatMonthpv(row.monthpv),
      market_bid: row.bid !== undefined && row.bid !== null ? (Number(row.bid) / 100).toFixed(2) : null,
    }));

    const exact = rows.find((row) => normalizeKeyword(row.keyword) === normalizeKeyword(keyword));
    if (exact) {
      return {
        ...exact,
        exact_match: true,
      };
    }

    const first = rows[0];
    if (!first) {
      return null;
    }

    return {
      ...first,
      exact_match: false,
    };
  } finally {
    await page.close();
  }
}

async function writeOutputs({ bindingKey, runKey, sourceRound, results }) {
  const outDir = path.join(OUTPUT_ROOT, sourceRound, runKey);
  await mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "results.json");
  const csvPath = path.join(outDir, "results.csv");

  await writeFile(jsonPath, JSON.stringify(results, null, 2), "utf8");
  await writeFile(csvPath, toCsv(results), "utf8");

  return {
    output_dir: outDir,
    json_path: jsonPath,
    csv_path: csvPath,
    binding_key: bindingKey,
  };
}

function toCsv(rows) {
  const headers = [
    "keyword",
    "matched_keyword",
    "search_volume",
    "search_volume_field",
    "competition_index",
    "market_bid",
    "recommendation_reason",
    "exact_match",
    "captured_at",
    "source_round",
    "source_platform",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  const raw = value === undefined || value === null ? "" : String(value);
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replaceAll("\"", "\"\"")}"`;
  }
  return raw;
}

function normalizeTaskPayload(taskPayload) {
  if (!taskPayload?.keywords?.length) {
    throw new BrowserModuleError("task_payload.keywords is required");
  }
  return {
    source_round: taskPayload.source_round || "manual_round_001",
    keywords: taskPayload.keywords,
    delay_ms: Number.isFinite(taskPayload.delay_ms) ? taskPayload.delay_ms : 1200,
  };
}

function normalizeKeyword(value) {
  return String(value || "").trim().toLowerCase();
}

function formatMonthpv(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (Number(value) === 0) {
    return "<100";
  }
  return String(value);
}

function mapRecommendReason(source, fallback) {
  if (fallback) {
    return fallback;
  }
  const mapping = {
    24: "上游词",
    25: "下游词",
    26: null,
  };
  return mapping[source] ?? null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
