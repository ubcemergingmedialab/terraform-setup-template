#!/usr/bin/env node
/**
 * Export all items from a DynamoDB table to a single JSON file (portable backup).
 *
 * Usage:
 *   npm ci
 *   aws sso login --profile lab          # if using SSO
 *   node export.mjs --profile lab --table eml_fields --out ./eml_fields-backup.json
 *
 * Authentication: standard AWS credential chain (--profile, AWS_PROFILE, or env keys).
 * Not HCP Terraform.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  createDynamoDocClient,
  parseAwsFlags,
  verifyCredentials,
} from "./aws-config.mjs";

const args = process.argv.slice(2);
function flag(name, fallback = "") {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const awsFlags = parseAwsFlags(args);
const tableName = flag("--table", "eml_fields");
const outPath = resolve(flag("--out", `./${tableName}-backup.json`));

const cfg = await verifyCredentials(awsFlags);
const client = createDynamoDocClient(cfg);

async function scanAll() {
  const items = [];
  let lastKey;
  do {
    const res = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

try {
  const items = await scanAll();
  const payload = {
    format: "virtual-soils-dynamodb-backup-v1",
    tableName,
    region: awsFlags.region,
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    hashKey: "FieldID",
    items,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Wrote ${items.length} items to ${outPath}`);
  console.log("Zip this file for handoff, e.g.:");
  console.log(
    `  Compress-Archive -Path '${outPath}' -DestinationPath '${tableName}-backup.zip' -Force`,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Export failed: ${message}`);
  if (message.includes("AccessDenied") || message.includes("not authorized")) {
    console.error("Ensure your IAM user/role has dynamodb:Scan on the table.");
  }
  process.exit(1);
}
