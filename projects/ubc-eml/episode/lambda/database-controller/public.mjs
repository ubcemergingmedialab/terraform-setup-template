const notImplemented = {
  statusCode: 501,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    error: "database_schema_pending",
    message: "Public database reads will be implemented with the approved Episode schema.",
  }),
};

export async function handler(event) {
  const method = event.requestContext?.http?.method;

  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json", allow: "GET" },
      body: JSON.stringify({ error: "public_controller_is_read_only" }),
    };
  }

  // Add filtered SELECT statements here after the schema and public exposure rules are approved.
  return notImplemented;
}