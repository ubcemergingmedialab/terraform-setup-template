import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "ca-central-1";
const TABLE = process.env.FIELDS_TABLE_NAME || "eml_fields";

/** Empty / "*" = all fields; otherwise comma-separated FieldID allowlist. */
function parsePinsFilterIds(raw) {
  if (raw === undefined || raw === null) return [];
  const trimmed = String(raw).trim();
  if (trimmed === "" || trimmed === "*") return [];
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

const pinsFilterIds = parsePinsFilterIds(process.env.PINS_FIELD_IDS);

const corsAllowOrigins = (process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function requestOrigin(event) {
  const headers = event?.headers ?? {};
  return headers.origin ?? headers.Origin;
}

/** Echo the browser Origin when allowed — required for admin + viewer on different CloudFront domains. */
function corsHeaders(event) {
  const origin = requestOrigin(event);
  const headers = {
    "Content-Type": "application/json",
  };

  if (origin && corsAllowOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const unwrapAttributeValue = (attr) => {
  if (attr === null || attr === undefined) return undefined;
  if (Array.isArray(attr)) return attr.map(unwrapAttributeValue);
  if (typeof attr !== "object") return attr;
  if ("S" in attr) return attr.S;
  if ("N" in attr) return Number(attr.N);
  if ("BOOL" in attr) return attr.BOOL;
  if ("NULL" in attr) return null;
  if ("L" in attr && Array.isArray(attr.L)) {
    return attr.L.map(unwrapAttributeValue);
  }
  if ("M" in attr && attr.M && typeof attr.M === "object") {
    return Object.fromEntries(
      Object.entries(attr.M).map(([key, value]) => [
        key,
        unwrapAttributeValue(value),
      ]),
    );
  }
  return attr;
};

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toStringValue = (value) =>
  typeof value === "string" ? value : undefined;

const parseMarkers = (raw) => {
  const normalized = unwrapAttributeValue(raw);
  if (!Array.isArray(normalized)) return [];

  return normalized
    .map((entry) => {
      if (!Array.isArray(entry) || entry.length < 4) return null;
      const [iconRaw, scaleRaw, positionRaw, textRaw] = entry;
      if (!Array.isArray(positionRaw) || positionRaw.length < 3) return null;

      const coords = positionRaw.slice(0, 3).map((value) => toNumber(value));
      if (coords.some((val) => typeof val !== "number")) return null;

      const scale = toNumber(scaleRaw);
      return {
        icon: toStringValue(iconRaw) ?? "",
        scale: scale ?? undefined,
        position: { x: coords[0], y: coords[1], z: coords[2] },
        text: toStringValue(textRaw) ?? "",
      };
    })
    .filter(Boolean);
};

const parseStartPos = (raw) => {
  const normalized = unwrapAttributeValue(raw);

  if (Array.isArray(normalized) && normalized.length >= 3) {
    const [x, y, z] = normalized.slice(0, 3).map((value) => toNumber(value));
    if ([x, y, z].every((value) => typeof value === "number")) {
      return { x, y, z };
    }
  }

  if (normalized && typeof normalized === "object") {
    const x = toNumber(normalized.x);
    const y = toNumber(normalized.y);
    const z = toNumber(normalized.z);
    if ([x, y, z].every((value) => typeof value === "number")) {
      return { x, y, z };
    }
  }

  return undefined;
};

/** PlayCanvas splat URL + format from DynamoDB (Phase 1 migration). */
function playCanvasAssetFields(item) {
  const fields = {};
  const url = toStringValue(item.FilePlayCanvas);
  const format = toStringValue(item.FileFormat);
  if (url) fields.FilePlayCanvas = url;
  if (format) fields.FileFormat = format;
  return fields;
}

async function getPins() {
  const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
  const filterSet = new Set(pinsFilterIds);
  return (data.Items || [])
    .filter((i) =>
      filterSet.size === 0 ? true : filterSet.has(String(i.FieldID)),
    )
    .map((i) => ({
      title: i.Name,
      position: { lat: Number(i.Latitude), lng: Number(i.Longitude) },
      path: i.File,
      ...playCanvasAssetFields(i),
      description: i.Description,
      thumbnail: i.Thumbnail,
      thumbnailAlt: i.ThumbnailAlt,
      start_pos: parseStartPos(i.start_pos),
      markers: parseMarkers(i.markers),
    }));
}

async function getFields() {
  const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
  return { items: data.Items || [] };
}

async function getFieldById(id) {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { FieldID: id } }),
  );
  return res.Item || null;
}

async function createField(body) {
  if (!body?.FieldID) throw new Error("FieldID required");
  await ddb.send(new PutCommand({ TableName: TABLE, Item: body }));
  return { item: body };
}

async function updateField(body) {
  const fieldId = body?.FieldID;
  if (!fieldId) throw new Error("FieldID required");
  const existing = await getFieldById(fieldId);
  if (!existing) return null;
  const merged = { ...existing, ...body, FieldID: fieldId };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: merged }));
  return { item: merged };
}

async function deleteField(fieldId) {
  if (!fieldId) throw new Error("FieldID required");
  await ddb.send(
    new DeleteCommand({ TableName: TABLE, Key: { FieldID: fieldId } }),
  );
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

export const handler = async (event) => {
  const path = event.rawPath || event.path;
  const method = event.requestContext?.http?.method || event.httpMethod;

  try {
    if (method === "GET" && path === "/pins") {
      return json(200, await getPins(), event);
    }

    if (method === "GET" && path === "/fields") {
      return json(200, await getFields(), event);
    }

    const fieldMatch = path.match(/^\/fields\/([^/]+)$/);
    if (method === "GET" && fieldMatch) {
      const item = await getFieldById(fieldMatch[1]);
      return item ? json(200, item, event) : json(404, { error: "Not found" }, event);
    }

    if (path === "/admin/api/fields") {
      if (method === "GET") {
        return json(200, await getFields(), event);
      }
      if (method === "POST") {
        const body = parseJsonBody(event);
        return json(201, await createField(body), event);
      }
      if (method === "PUT") {
        const body = parseJsonBody(event);
        const result = await updateField(body);
        return result ? json(200, result, event) : json(404, { error: "Not found" }, event);
      }
      if (method === "DELETE") {
        const body = parseJsonBody(event);
        await deleteField(body?.FieldID);
        return json(204, null, event);
      }
    }

    return json(404, { error: "Not found" }, event);
  } catch (e) {
    console.error(e);
    return json(500, { error: "Server error" }, event);
  }
};

const json = (status, body, event) => ({
  statusCode: status,
  headers: corsHeaders(event),
  body: body === null || body === undefined ? "" : JSON.stringify(body),
});
