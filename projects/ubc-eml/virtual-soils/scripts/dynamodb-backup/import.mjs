#!/usr/bin/env node
/**
 * Import items from a portable backup JSON (from export.mjs) into a DynamoDB table.
 *
 * Usage:
 *   npm ci
 *   aws sso login --profile lab
 *   node import.mjs --profile lab --file ./eml_fields-backup.json --table eml_fields
 *
 * Authentication: standard AWS credential chain (--profile, AWS_PROFILE, or env keys).
 * Not HCP Terraform.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
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

const fileArg = flag("--file");
if (!fileArg) {
  console.error(
    "Usage: node import.mjs --file ./eml_fields-backup.json [--table eml_fields] [--profile lab] [--region ca-central-1]",
  );
  process.exit(1);
}

const filePath = resolve(fileArg);
const tableOverride = flag("--table");
const awsFlags = parseAwsFlags(args);

let raw;
try {
  raw = JSON.parse(readFileSync(filePath, "utf8"));
} catch (err) {
  console.error(`Could not read backup file: ${filePath}`);
  process.exit(1);
}

if (raw.format !== "virtual-soils-dynamodb-backup-v1") {
  console.error("Unrecognized backup format. Expected virtual-soils-dynamodb-backup-v1.");
  process.exit(1);
}

const targetTable = tableOverride || raw.tableName;
const items = raw.items || [];

const cfg = await verifyCredentials(awsFlags);
const client = createDynamoDocClient(cfg);

const BATCH = 25;
let written = 0;

try {
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [targetTable]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      }),
    );
    written += chunk.length;
    console.log(`Wrote ${written}/${items.length}`);
  }

  console.log(`Done. Imported ${written} items into ${targetTable}.`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Import failed: ${message}`);
  if (message.includes("AccessDenied") || message.includes("not authorized")) {
    console.error(
      "Ensure your IAM user/role has dynamodb:BatchWriteItem on the target table.",
    );
  }
  if (message.includes("ResourceNotFoundException")) {
    console.error(`Table "${targetTable}" does not exist in ${awsFlags.region}.`);
  }
  process.exit(1);
}
