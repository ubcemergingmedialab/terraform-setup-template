"""
Minimal health endpoint for the MootCourt agent container.

The LiveKit agent is an outbound worker, not an HTTP server, but the ECS service
sits behind an ALB target group that needs a healthy HTTP target. This runs a
tiny HTTP server on HEALTH_PORT (default 8081) that returns 200 on /health, so
the ALB can report the task healthy while the real work is the agent's worker
connection to LiveKit Cloud.

Run as a background thread from entrypoint.sh alongside `python agent.py start`.
"""

import os
from http.server import BaseHTTPRequestHandler, HTTPServer

HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8081"))


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (http.server API)
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):  # silence per-request logging
        pass


def main():
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), _Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
