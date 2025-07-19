const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");
const fs = require("fs");
const prism = require("prism-media");
const { Readable } = require("stream");

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_SIZE = 960 * CHANNELS * 2; // 20ms frame @ 48kHz, 16-bit stereo

class Mixer {
  constructor() {
    this.connection = null;
    this.player = null;
    this.mixedStream = null;
    this.sources = new Map(); // key: id, value: { stream, volume }
  }

  generateSilenceFrame() {
    return Buffer.alloc(FRAME_SIZE);
  }

  mixBuffers(buffers, volumes) {
    if (buffers.length === 0) return this.generateSilenceFrame();
    const mixed = Buffer.alloc(FRAME_SIZE);

    for (let i = 0; i < FRAME_SIZE; i += 2) {
      let sample = 0;
      buffers.forEach((buf, idx) => {
        if (buf.length >= i + 2) {
          let s = buf.readInt16LE(i);
          sample += s * volumes[idx];
        }
      });
      sample = Math.max(Math.min(sample, 32767), -32768);
      mixed.writeInt16LE(sample, i);
    }

    return mixed;
  }

  createMixerStream() {
    return new Readable({
      read: () => {
        const buffers = [];
        const volumes = [];

        for (const [id, { stream, volume }] of this.sources.entries()) {
          const chunk = stream.read(FRAME_SIZE);
          if (chunk) {
            buffers.push(chunk);
            volumes.push(volume ?? 1.0);
          }
        }

        const mixed = this.mixBuffers(buffers, volumes);
        this.mixedStream.push(mixed);
      },
    });
  }

  decodeAudio(filePath) {
    const ffmpeg = new prism.FFmpeg({
      args: [
        "-i",
        filePath,
        "-f",
        "s16le",
        "-ar",
        SAMPLE_RATE.toString(),
        "-ac",
        CHANNELS.toString(),
      ],
    });

    const pcm = new Readable().wrap(ffmpeg);
    pcm._readableState.highWaterMark = FRAME_SIZE * 10;
    return pcm;
  }

  async playSound(guild, voiceChannel, soundId, filePath, volume = 1.0) {
    if (!fs.existsSync(filePath)) throw new Error("File not found");

    if (!this.connection) {
      this.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      this.mixedStream = this.createMixerStream();

      const resource = createAudioResource(this.mixedStream, {
        inputType: StreamType.Raw,
      });

      this.player = createAudioPlayer();
      this.player.play(resource);
      this.connection.subscribe(this.player);

      this.player.on("error", console.error);
    }

    const stream = this.decodeAudio(filePath);
    this.sources.set(soundId, { stream, volume });

    stream.on("end", () => {
      this.sources.delete(soundId);
      console.log(`[END] ${soundId}`);
    });

    stream.on("error", (err) => {
      this.sources.delete(soundId);
      console.error(`[ERROR] ${soundId}:`, err);
    });

    return `Playing ${soundId}`;
  }

  stopSound(soundId) {
    if (this.sources.has(soundId)) {
      const { stream } = this.sources.get(soundId);
      stream.destroy();
      this.sources.delete(soundId);
      return `Stopped ${soundId}`;
    }
    return `Sound ${soundId} not found`;
  }

  setVolume(soundId, volume) {
    if (this.sources.has(soundId)) {
      this.sources.get(soundId).volume = volume;
      return `Volume of ${soundId} set to ${volume}`;
    }
    return `Sound ${soundId} not found`;
  }

  resetAll() {
    this.sources.forEach(({ stream }) => stream.destroy());
    this.sources.clear();
    if (this.player) this.player.stop();
    if (this.connection) this.connection.destroy();
    this.connection = null;
    return `All sounds stopped and connection closed.`;
  }
}

module.exports = Mixer;
