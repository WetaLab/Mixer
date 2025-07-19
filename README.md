# Mixer

Mixer is a lightweight audio mixer for Discord bots using `@discordjs/voice`. It allows you to play multiple audio streams simultaneously with individual volume control.

## Features

- Join voice channel and play raw PCM audio
- Mix multiple sources into one output
- Per-stream volume control
- Auto cleanup after playback

## Installation

```bash
npm install @wetalabs/mixer
```

## Usage

```js
const { joinVoiceChannel } = require("@discordjs/voice");
const Mixer = require("@wetalabs/mixer");

const mixer = new Mixer();

const connection = joinVoiceChannel({
  channelId: voiceChannel.id,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator,
});

mixer.attachConnection(connection);

await mixer.playSound("intro", "./sounds/intro.mp3", 0.8);

mixer.resetAll();
connection.destroy();
```

Here’s the updated **API documentation** to match the revised version of your `Mixer` class, where connection handling is done externally:

---

## API

### `attachConnection(connection)`

Attaches an existing Discord voice connection to the mixer.
Must be called before playing any sounds.

- **Params:**

  - `connection`: A valid voice connection object from `@discordjs/voice`.

---

### `detachConnection()`

Detaches the current voice connection and stops playback.
Does not destroy the connection.

---

### `playSound(soundId, filePath, volume?)`

Plays a sound from the given file path with a unique ID and optional volume.
Requires `attachConnection()` to be called first.

- **Params:**

  - `soundId`: A unique identifier for the sound.
  - `filePath`: Path to a valid audio file.
  - `volume?` _(optional)_: A number between `0.0` and `1.0` (default is `1.0`).

---

### `stopSound(soundId)`

Stops and removes a currently playing sound by its ID.

- **Params:**

  - `soundId`: The ID of the sound to stop.

---

### `setVolume(soundId, volume)`

Changes the volume of a currently playing sound.

- **Params:**

  - `soundId`: The ID of the sound.
  - `volume`: A number between `0.0` and `1.0`.

---

### `resetAll()`

Stops all currently playing sounds and resets the mixer state.
**Note:** This does _not_ disconnect the voice connection — use `detachConnection()` for that.

## Events

Mixer extends `EventEmitter` and emits events you can hook into:

| Event      | Description                              | Callback Args       |
| ---------- | ---------------------------------------- | ------------------- |
| `play`     | Emitted when a sound starts playing      | `soundId`           |
| `end`      | Emitted when a sound finishes playing    | `soundId`           |
| `stop`     | Emitted when a sound is manually stopped | `soundId`           |
| `volume`   | Emitted when volume is changed           | `soundId`, `volume` |
| `error`    | Emitted on playback/streaming error      | `soundId`, `error`  |
| `reset`    | Emitted when `resetAll()` is called      | —                   |
| `attached` | Emitted when a connection is attached    | —                   |
| `detached` | Emitted when the connection is detached  | —                   |

## License

MIT
