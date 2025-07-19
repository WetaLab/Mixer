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
const Mixer = require("@wetalabs/mixer");
const mixer = new Mixer();

await mixer.playSound(guild, voiceChannel, "intro", "./sounds/intro.mp3", 0.8);
```

## API
`playSound(guild, voiceChannel, soundId, filePth, volume?)`
Play a sound with the given ID and optional volume.

`stopSound(soundId)`
Stops and removes a playing sound.

`setVolume(soundId, volume)`
Adjusts the volume of a specific sound.

`resetAll()`
Stops all sounds and disconnects from the voice channel.

## License

MIT