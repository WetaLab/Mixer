const {
  createAudioPlayer,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");
const fs = require("fs");
const prism = require("prism-media");
const { Readable } = require("stream");
const EventEmitter = require("events");

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_SIZE = 960 * CHANNELS * 2; // 20ms frame @ 48kHz, 16-bit stereo

class Mixer extends EventEmitter {
  constructor(verbose = false) {
    super();
    this.connection = null;
    this.player = null;
    this.mixedStream = null;
    this.sources = new Map(); // key: id, value: { stream, volume }
    this.verbose = verbose;
  }

  attachConnection(connection) {
    this.connection = connection;

    if (!this.player) {
      this.mixedStream = this.createMixerStream();

      const resource = createAudioResource(this.mixedStream, {
        inputType: StreamType.Raw,
      });

      this.player = createAudioPlayer();
      this.player.play(resource);
      this.connection.subscribe(this.player);

      this.player.on("error", (err) => {
        this.emit("error", "player", err);
        console.error(err);
      });

      this.emit("attached");
    }
  }

  detachConnection() {
    this.connection = null;
    if (this.player) {
      this.player.stop();
      this.player = null;
    }
    this.mixedStream = null;
    this.emit("detached");
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

  async playSound(soundId, filePath, volume = 1.0) {
    if (!fs.existsSync(filePath)) throw new Error("File not found");
    if (!this.connection || !this.player)
      throw new Error("Mixer is not attached to a connection");

    const stream = this.decodeAudio(filePath);
    this.sources.set(soundId, { stream, volume });

    this.emit("play", soundId);

    stream.on("end", () => {
      this.sources.delete(soundId);
      this.emit("end", soundId);
      if (this.verbose) console.log(`[END] ${soundId}`);
    });

    stream.on("error", (err) => {
      this.sources.delete(soundId);
      this.emit("error", soundId, err);
      if (this.verbose) console.error(`[ERROR] ${soundId}:`, err);
    });

    return `Playing ${soundId}`;
  }

  stopSound(soundId) {
    if (this.sources.has(soundId)) {
      const { stream } = this.sources.get(soundId);
      stream.destroy();
      this.sources.delete(soundId);
      this.emit("stop", soundId);
      return `Stopped ${soundId}`;
    }
    return `Sound ${soundId} not found`;
  }

  setVolume(soundId, volume) {
    if (this.sources.has(soundId)) {
      this.sources.get(soundId).volume = volume;
      this.emit("volume", soundId, volume);
      return `Volume of ${soundId} set to ${volume}`;
    }
    return `Sound ${soundId} not found`;
  }

  resetAll() {
    this.sources.forEach(({ stream }, soundId) => {
      stream.destroy();
      this.emit("stop", soundId);
    });

    this.sources.clear();
    if (this.player) this.player.stop();
    this.player = null;
    this.mixedStream = null;

    this.emit("reset");
    return `All sounds stopped and mixer reset.`;
  }
}

module.exports = Mixer;
