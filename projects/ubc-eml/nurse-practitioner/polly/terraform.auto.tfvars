client_name  = "ubc-eml"
project_name = "np-polly"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "emerging-media-lab"
  Repo  = "NursePractitioner"
}

# Default Polly voice + format. mp3 is decoded by RuntimeAudioImporter on the
# Unreal side and fed into the existing UAudioManager playback queue.
default_voice_id      = "Tiffany"
default_output_format = "mp3"

# tts_shared_secret is intentionally NOT set here — this file is committed.
# Provide it as a sensitive HCP workspace variable on ubc-eml-np-polly.
