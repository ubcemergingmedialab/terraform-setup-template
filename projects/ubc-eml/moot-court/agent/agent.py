"""
MootCourt LiveKit voice agent (prototype).

A cascaded STT -> LLM -> TTS voice agent that plays the appellate judge. It uses
AWS directly via livekit-plugins-aws (Option A in livekit-prototype-plan.md):

    STT  -> Amazon Transcribe (streaming)
    LLM  -> Amazon Bedrock (Claude Sonnet, global.anthropic.claude-sonnet-4-6)
    TTS  -> Amazon Polly (voice Tiffany, generative engine)

Credentials: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET and AWS_REGION are
read from the repo-root .env (one level up from this folder). AWS credentials are
NOT required in .env — prefer an AWS profile via `aws login` + `export AWS_PROFILE=...`
(boto3's credential chain picks it up). AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in
.env still work as a fallback and override the profile. See README.md ("AWS
authentication").

Run it:
    # 1. One-off smoke test with no browser (talk to it in the terminal):
    python agent.py console

    # 2. Join real LiveKit rooms (used with the React app + token server):
    python agent.py dev
"""

import logging
import os
import uuid
from pathlib import Path
from typing import AsyncIterable

from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
)
from livekit.plugins import aws, silero

import prompts

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
# The real credentials live in the repo-root .env (gitignored), one directory
# up from this file. Load it explicitly so the agent works regardless of the
# current working directory.
REPO_ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=REPO_ROOT_ENV)
# Also load a local livekit-agent/.env if present (overrides repo-root values).
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

# Fallback only: if AWS keys are supplied in .env (instead of the preferred AWS
# profile), an older .env may name the secret AWS_ACCESS_KEY_SECRET while boto3
# expects the standard AWS_SECRET_ACCESS_KEY. Bridge the two. When neither is set,
# boto3 falls through to the profile / credential chain (e.g. `aws login`).
if not os.getenv("AWS_SECRET_ACCESS_KEY") and os.getenv("AWS_ACCESS_KEY_SECRET"):
    os.environ["AWS_SECRET_ACCESS_KEY"] = os.environ["AWS_ACCESS_KEY_SECRET"]

# Default region if the .env didn't set one. ca-central-1 matches the existing
# NursePractitioner stack.
os.environ.setdefault("AWS_REGION", "ca-central-1")

logger = logging.getLogger("mootcourt-agent")
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
AWS_REGION = os.environ["AWS_REGION"]
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")


def _resolve_stt_credentials():
    """
    Resolve AWS credentials for Amazon Transcribe (STT) explicitly.

    Why this is needed: the LLM (Bedrock) and TTS (Polly) plugins use
    aiobotocore/boto3, whose credential chain supports named profiles and SSO /
    `aws login` caches. But the STT plugin uses the smithy-based
    `aws_sdk_transcribe_streaming`, whose default resolver chain only checks
    static args, ENVIRONMENT VARIABLES, container, and IMDS — it does NOT read
    `~/.aws` profiles or SSO caches. So with profile-based auth the judge can
    greet you (LLM+TTS work) but never transcribe you (STT silently fails).

    We use boto3 to resolve whatever credentials the rest of the app is using
    (profile, SSO/`aws login`, or env vars) and hand them to aws.STT explicitly,
    so STT authenticates the same way as LLM/TTS. Returns None if boto3 can't
    find credentials (then STT falls back to its env-only chain).
    """
    try:
        # botocore (bundled with the AWS plugins) resolves the full chain —
        # profiles, SSO / `aws login` caches, and env vars — unlike the STT
        # plugin's own env-only resolver. (boto3 itself may not be installed;
        # botocore.session is enough and is always present.)
        import botocore.session
        from livekit.plugins.aws.stt import Credentials

        session = botocore.session.get_session()
        creds = session.get_credentials()
        if creds is None:
            logger.warning(
                "botocore found no AWS credentials for STT; falling back to the "
                "plugin's env-only resolver. If STT produces no transcripts, "
                "run `aws login` / set AWS_PROFILE, or put keys in the env."
            )
            return None
        frozen = creds.get_frozen_credentials()
        logger.info("STT credentials resolved via botocore (method=%s)", creds.method)
        return Credentials(
            access_key_id=frozen.access_key,
            secret_access_key=frozen.secret_key,
            session_token=frozen.token,
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("Could not resolve STT credentials via botocore: %s", e)
        return None
POLLY_VOICE = os.getenv("POLLY_VOICE", "Tiffany")
POLLY_ENGINE = os.getenv("POLLY_ENGINE", "generative")  # generative | neural | standard
# Which side counsel is arguing; picks the matching question themes.
PLAYER_POSITION = os.getenv("MOOT_PLAYER_POSITION", "Appellant")


# ---------------------------------------------------------------------------
# A/B/C judge-audio test harness — PCM tee (agent side)
# ---------------------------------------------------------------------------
# Topic the raw pre-Opus judge PCM is teed to. The frontend registers a byte-
# stream handler on this exact topic to drive the Simli avatar in Mode B/C.
JUDGE_PCM_TOPIC = "judge-pcm"


class JudgeAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=prompts.build_instructions(PLAYER_POSITION))
        # The LiveKit room, captured in on_enter, so tts_node can open byte
        # streams on the local participant. Set once the session starts.
        self._room: rtc.Room | None = None

    def set_room(self, room: rtc.Room) -> None:
        """Give the agent the room so tts_node can tee PCM over a byte stream."""
        self._room = room

    async def tts_node(
        self, text: AsyncIterable[str], model_settings
    ) -> AsyncIterable[rtc.AudioFrame]:
        """
        TEE the judge's synthesized audio frames to a LiveKit byte stream while
        passing them through UNCHANGED to the normal Opus publish pipeline.

        This is the agent half of the A/B/C judge-audio test harness. The agent
        is mode-AGNOSTIC: it ALWAYS tees the raw pre-Opus PCM in addition to the
        normal publish. The FRONTEND toggle (A/B/C) decides what actually drives
        the Simli avatar, so switching modes needs no agent restart.

        Byte-stream protocol (topic "judge-pcm"):
          - ONE ByteStreamWriter is opened per utterance (one tts_node call ==
            one utterance). Its attributes carry the audio format + an id:
              sampleRate  : str(frame.sample_rate)   e.g. "24000"
              numChannels : str(frame.num_channels)  e.g. "1"
              utteranceId : a fresh uuid4 hex string, unique per utterance
          - Each frame's PCM16 LE bytes (bytes(frame.data), a memoryview of
            Int16 LE) are written to the stream as they synthesize.
          - The writer is closed when this utterance's frame stream ends.

        Mode A still relies on the normal high-fidelity Opus track, so every
        frame is yielded through unchanged and the agent's own timing is
        unaffected. All byte-stream I/O is best-effort: a streaming failure is
        logged but never crashes the agent or interrupts the audio pipeline.
        """
        # Pull the normal TTS frame stream from the default implementation; we
        # only observe frames in passing and yield them through untouched.
        source = Agent.default.tts_node(self, text, model_settings)

        writer = None  # opened lazily on the first frame of this utterance
        utterance_id = uuid.uuid4().hex

        try:
            async for frame in source:
                # TEE: best-effort PCM write. Any failure here must not disturb
                # the pass-through (Mode A) pipeline, so it is isolated.
                room = self._room
                if room is not None:
                    try:
                        if writer is None:
                            writer = await room.local_participant.stream_bytes(
                                name=JUDGE_PCM_TOPIC,
                                topic=JUDGE_PCM_TOPIC,
                                attributes={
                                    "sampleRate": str(frame.sample_rate),
                                    "numChannels": str(frame.num_channels),
                                    "utteranceId": utterance_id,
                                },
                            )
                            logger.info(
                                "judge-pcm: opened stream utterance=%s rate=%s ch=%s",
                                utterance_id,
                                frame.sample_rate,
                                frame.num_channels,
                            )
                        # frame.data is a memoryview of Int16 LE samples;
                        # bytes(frame.data) is the PCM16 LE payload.
                        await writer.write(bytes(frame.data))
                    except Exception as e:  # pragma: no cover - defensive
                        logger.warning("judge-pcm: write failed: %s", e)

                # PASS-THROUGH: Mode A's normal Opus pipeline consumes these.
                yield frame
        finally:
            # Close the per-utterance writer when the frame stream ends.
            if writer is not None:
                try:
                    await writer.aclose()
                    logger.info("judge-pcm: closed stream utterance=%s", utterance_id)
                except Exception as e:  # pragma: no cover - defensive
                    logger.warning("judge-pcm: close failed: %s", e)

    async def on_enter(self):
        # Deliver the judge's opening line as soon as the session starts, then
        # listen. generate_reply lets the LLM phrase the intro in-character; the
        # scripted intro is used as the instruction for this first turn.
        await self.session.generate_reply(
            instructions=(
                f'Greet counsel and invite them to begin, in your own words, '
                f'along the lines of: "{prompts.JUDGE_INTRO_SPEECH}"'
            )
        )


def prewarm(proc: JobProcess):
    # Load the VAD once per worker process for open-mic turn detection.
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Resolve STT credentials up front (see _resolve_stt_credentials for why).
    _stt_credentials = _resolve_stt_credentials()

    session = AgentSession(
        # Amazon Transcribe streaming STT. Do NOT force sample_rate here: the
        # browser mic is not 16 kHz, and the agent pipeline resamples audio to
        # whatever rate the STT declares. Forcing a mismatched rate feeds
        # Transcribe mis-rated audio and yields no transcripts (the agent then
        # greets fine but never "hears" you). Let the plugin use its default.
        stt=aws.STT(
            region=AWS_REGION,
            language="en-US",
            # Pass credentials explicitly so STT uses the same profile/SSO/env
            # auth as LLM/TTS (its own resolver can't read ~/.aws profiles).
            **({"credentials": _stt_credentials} if _stt_credentials else {}),
        ),
        # Amazon Bedrock LLM (Claude Sonnet via global inference profile).
        llm=aws.LLM(
            model=BEDROCK_MODEL_ID,
            region=AWS_REGION,
            temperature=0.7,
        ),
        # Amazon Polly TTS.
        tts=aws.TTS(
            voice=POLLY_VOICE,
            speech_engine=POLLY_ENGINE,
            region=AWS_REGION,
        ),
        # Silero VAD drives automatic turn detection for the open-mic flow.
        vad=ctx.proc.userdata["vad"],
    )

    # --- Diagnostics -------------------------------------------------------
    # Log transcribed user speech. If these never fire while you talk, inbound
    # audio isn't reaching STT (mic not published/subscribed, or a sample-rate
    # mismatch yielding empty transcripts).
    @session.on("user_input_transcribed")
    def _on_user_transcript(ev):
        logger.info(
            "USER SAID (final=%s): %r",
            getattr(ev, "is_final", "?"),
            getattr(ev, "transcript", ev),
        )

    # Agent state transitions (listening -> thinking -> speaking). "listening"
    # confirms the agent is actively consuming your audio.
    @session.on("agent_state_changed")
    def _on_agent_state(ev):
        logger.info("agent state -> %s", getattr(ev, "new_state", ev))

    # THE DECISIVE DIAGNOSTIC: user state flips to "speaking" when the VAD hears
    # you. If this NEVER fires while you talk, audio frames aren't reaching the
    # VAD at all (publish/subscribe/empty-frame problem). If it DOES fire but no
    # "USER SAID" follows, the problem is STT (format/rate), not the mic.
    @session.on("user_state_changed")
    def _on_user_state(ev):
        logger.info("USER state -> %s (VAD)", getattr(ev, "new_state", ev))

    # Fires when VAD detected speech but no transcript came back for the turn —
    # a strong signal of an STT config/audio problem rather than a mic problem.
    @session.on("user_transcription_timeout")
    def _on_transcription_timeout(ev):
        logger.warning(
            "VAD heard speech but STT returned NO transcript (%.2fs). "
            "Likely an STT sample-rate/audio-format mismatch.",
            getattr(ev, "speech_duration", 0.0),
        )

    # Confirm the agent actually subscribed to the user's audio track.
    @ctx.room.on("track_subscribed")
    def _on_track_subscribed(track, pub, participant):
        logger.info(
            "subscribed to %s track from %s",
            getattr(track, "kind", "?"),
            getattr(participant, "identity", "?"),
        )
    # -----------------------------------------------------------------------

    # Connect to the room FIRST, then start the session. Order matters: the
    # session subscribes to the participant's audio track when it starts, so the
    # room must already be connected. (Starting before connecting is why the
    # agent could speak its greeting but never hear/respond to the user.)
    await ctx.connect()
    # Build the judge and hand it the room so its tts_node can open a byte
    # stream on the local participant to TEE raw PCM to the browser. The room
    # must be connected first (done by ctx.connect() above).
    judge = JudgeAgent()
    judge.set_room(ctx.room)

    # JUDGE AUDIO PATH: the browser drives the Simli avatar from the raw PCM we
    # tee in `tts_node` (clean, pre-Opus -> crisp lip-sync), NOT from the Opus
    # audio track.
    #
    # We nevertheless KEEP publishing the audio track, because the frontend uses
    # it as the judge's PRESENCE/READINESS signal: the CourtroomPage lifecycle
    # gate waits for `useVoiceAssistant().audioTrack` (a published MICROPHONE
    # audio track) to appear before starting Simli. Disabling audio output
    # entirely removes that track, so the frontend hangs at "waiting for the
    # judge to join". (That is the regression we hit when audio_enabled=False.)
    #
    # The track no longer needs to be HIGH fidelity (Simli uses the PCM), so we
    # drop the former dtx-off / 128 kbps high-quality publish options and let it
    # publish at LiveKit defaults — a cheap, low-bitrate "presence beacon". This
    # removes the expensive part of the old double-send (the 128 kbps duplicate)
    # while keeping the track the frontend's lifecycle depends on.
    await session.start(
        agent=judge,
        room=ctx.room,
        # Be explicit that we consume the user's audio track.
        room_input_options=RoomInputOptions(audio_enabled=True),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
