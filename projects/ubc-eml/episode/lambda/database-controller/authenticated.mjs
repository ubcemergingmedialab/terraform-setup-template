const notImplemented = {
  statusCode: 501,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    error: "database_schema_pending",
    message: "Authenticated database edits will be implemented with the approved Episode schema.",
  }),
};

export async function handler(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const method = event.requestContext?.http?.method;

  if (!claims.sub) {
    return {
      statusCode: 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "authenticated_subject_missing" }),
    };
  }

  if (!["POST", "PUT", "DELETE"].includes(method)) {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json", allow: "POST, PUT, DELETE" },
      body: JSON.stringify({ error: "authenticated_controller_edit_methods_only" }),
    };
  }

  // Use claims.sub for ownership/audit fields when the schema and edit rules are approved.
  return notImplemented;
}