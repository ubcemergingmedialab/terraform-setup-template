client_name  = "ubc-eml"
project_name = "moot-court"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "media-lab"
}

# TODO: set the real approved-user email before apply.
admin_email = "someone@ubc.ca"

# TODO: set your LiveKit Cloud project URL.
livekit_url = "wss://your-project.livekit.cloud"

extra_callback_urls = ["http://localhost:5173"]
extra_logout_urls   = ["http://localhost:5173"]

agent_image_tag = "latest"

polly_voice          = "Tiffany"
polly_engine         = "generative"
moot_player_position = "Appellant"
moot_room_name       = "mootcourt"

# Sensitive values (livekit_api_key, livekit_api_secret, simli_api_key) are set
# in the HCP workspace, not here.
