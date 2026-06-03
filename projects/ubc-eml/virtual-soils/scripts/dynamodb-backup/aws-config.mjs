/**
 * Shared AWS client setup. Uses the standard credential chain (not HCP / Terraform).
 *
 * Precedence: --profile flag > AWS_PROFILE env > default profile / env keys / SSO cache.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

export function parseAwsFlags(args) {
  function flag(name, fallback = "") {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  }

  const region = flag("--region") || process.env.AWS_REGION || "ca-central-1";
  const profile = flag("--profile") || process.env.AWS_PROFILE || undefined;

  return { region, profile };
}

export function clientConfig({ region, profile }) {
  return profile ? { region, profile } : { region };
}

export async function verifyCredentials(awsFlags) {
  const cfg = clientConfig(awsFlags);

  try {
    const sts = new STSClient(cfg);
    const id = await sts.send(new GetCallerIdentityCommand({}));
    const profileNote = awsFlags.profile ? `, profile: ${awsFlags.profile}` : "";
    console.log(
      `Authenticated — account ${id.Account}, region ${awsFlags.region}${profileNote}`,
    );
    return cfg;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AWS authentication failed. This script needs credentials on your machine.");
    console.error("");
    console.error("It does NOT use HCP Terraform or the HCPTerraform OIDC role.");
    console.error("");
    console.error("Set up one of:");
    console.error("  1. AWS SSO:  aws sso login --profile lab");
    console.error("               node export.mjs --profile lab ...");
    console.error("  2. Named profile in ~/.aws/credentials (AWS CLI configured)");
    console.error("  3. Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
    console.error("                           optional: AWS_SESSION_TOKEN, AWS_REGION");
    console.error("");
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

export function createDynamoDocClient(cfg) {
  return DynamoDBDocumentClient.from(new DynamoDBClient(cfg));
}
