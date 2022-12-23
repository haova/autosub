<script setup>
import { ref, shallowRef } from 'vue';
import AudioPeaks from 'vue-peaks/src/components/AudioPeaks.vue';
import { captionToString, download } from './utils';

const STORAGE_CAPTION_KEY = 'autosub.text';
const STORAGE_CONFIG_KEY = 'autosub.config';

const SLIENT_POINT = 2;
const TIME_RANGE = .1;

const audioInput = ref(null);
const audioSrc = ref(null);
const audioPlayer = ref(null);
const captions = ref([]);
const previewText = ref('');

const audioPeaks = shallowRef();
const slientPoint = ref(SLIENT_POINT);
const timeRange = ref(TIME_RANGE);

let currentId = 0;
let isTiming = false;

const changeAudioInput = () => {
  audioSrc.value = URL.createObjectURL(audioInput.value.files[0]);
  save();
}

const analyze = () => {
  if (!audioPeaks.value || !audioPeaks.value.peaksInstance)
    return;

  const peaksInstance = audioPeaks.value.peaksInstance;
  const waveform = peaksInstance.getWaveformData(); 

  const toTime = rate => rate * waveform.scale / waveform.sample_rate;
  const toRate = time => Math.floor(time * waveform.sample_rate / waveform.scale);

  const maxSamples = [];

  const caps = [];
  let start = null;
  
  for (let i = 0; i < waveform.length; i++) {
    maxSamples.push(waveform.channel(0).max_sample(i));
  }

  const scaleRate = toRate(parseFloat(timeRange.value));
  const rangeSamples = [];
  for (let i = 0; i < maxSamples.length; i += scaleRate) {
    rangeSamples.push(maxSamples.slice(i, i + scaleRate).reduce((sum, cur) => sum + cur, 0));
  }

  for (let i = 0; i < rangeSamples.length; i++) {
    let sample = rangeSamples[i];

    if (start === null && sample > parseInt(slientPoint.value) * scaleRate) {
      start = i;
      continue;
    }

    if (start !== null && sample < parseInt(slientPoint.value) * scaleRate) {
      let seg = {
        start: start * scaleRate,
        end: i * scaleRate,
        startTime: toTime(start * scaleRate),
        endTime: toTime(i * scaleRate),
      };

      caps.push({
        id: ++currentId,
        start: seg.startTime,
        end: seg.endTime,
        text: '',
      });

      start = null;
      continue;
    }
  }

  captions.value = caps;
}

const render = () => {
  if (!audioPeaks.value || !audioPeaks.value.peaksInstance)
    return;

  const peaksInstance = audioPeaks.value.peaksInstance;
  peaksInstance.segments.removeAll();

  for (let caption of captions.value) {
    peaksInstance.segments.add({
      startTime: caption.start,
      endTime: caption.end,
      labelText: caption.text,
    });
  }
}

const doExport = () => {
  download('subtitle.srt', captionToString(captions.value));
}

const importText = () => {
  const data = window.prompt('Paste your Text here: ');
  captions.value = data.split('\n').map(text => ({
    id: ++currentId,
    text,
    start: 0,
    end: 0,
  }));
  isTiming = false;
  autoTiming();
  save();
}

const autoTiming = () => {
  if (isTiming || !audioPlayer.value || !captions.value || captions.value.length === 0)
    return;

  const captionDuration = audioPlayer.value.duration / captions.value.length;
  let lastStart = 0;
  for (let caption of captions.value) {
    caption.start = lastStart;
    caption.end = lastStart + captionDuration;
    lastStart = caption.end;
  }

  isTiming = true;

  save();
}

const updateTime = () => {
  if (!captions.value)
    return;

  const ctime = audioPlayer.value.currentTime;
  previewText.value = '';

  for (let caption of captions.value) {
    if (caption.start <= ctime && caption.end > ctime) {
      previewText.value += (previewText.value ? '\n' : '') + caption.text;
    }
  }
}

const roundTime = time => {
  let text = `${Math.floor(time * 100) / 100}`;

  if (text.indexOf('.') === -1)
    text += '.';

  while (text.split('.')[1].length < 2) {
    text += '0';
  }

  return text;

}

const setTime = (caption, type) => {
  if (!audioPlayer.value)
    return;

  caption[type] = audioPlayer.value.currentTime;
  save();
}

const save = () => {
  sessionStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({
    isTiming,
  }));
  sessionStorage.setItem(STORAGE_CAPTION_KEY, JSON.stringify(captions.value));
}

const load = () => {
  const captionRaw = sessionStorage.getItem(STORAGE_CAPTION_KEY);
  try {
    captions.value = JSON.parse(captionRaw);
  } catch(_) {};

  const configRaw = sessionStorage.getItem(STORAGE_CONFIG_KEY);
  try {
    const config = JSON.parse(configRaw);
    isTiming = config.isTiming;
  } catch(_) {};
}

load();
</script>

<template>
  <div class="h-[100vh] overflow-hidden">
    <div class="w-full bg-white shadow pt-4">
      <div class="flex px-2 text-xs">
        <label for="audio-input" class="bg-sky-500 text-white px-2 py-1 rounded inline-block mx-2 cursor-pointer">Import Audio</label>
        <button class="bg-sky-500 text-white px-2 py-1 rounded inline-block mx-2 cursor-pointer" @click="importText">Import Text</button>
        <div class="w-[1px] bg-gray-200 mx-2"></div>
        <input v-model="slientPoint" class="outline-none border rounded mx-2 px-2 py-1" placeholder="Slient Point (0-100)" />
        <input v-model="timeRange" class="outline-none border rounded mx-2 px-2 py-1" placeholder="Time Range (second(s))"/>
        <button class="bg-sky-500 text-white px-2 py-1 rounded inline-block mx-2 cursor-pointer" @click="analyze(); render();">Analyze</button>
        <div class="w-[1px] bg-gray-200 mx-2"></div>
        <button class="bg-sky-500 text-white px-2 py-1 rounded inline-block mx-2 cursor-pointer" @click="doExport">Export</button>
      </div>

      <input id="audio-input" class="hidden" ref="audioInput" type="file" @change="changeAudioInput" />

      <div class="player m-4" :hide-peaks="!audioSrc">
        <AudioPeaks ref="audioPeaks">
          <audio
            class="w-full bg-transparent"
            ref="audioPlayer"
            :src="audioSrc"
            @loadedmetadata="autoTiming"
            @timeupdate="updateTime"
            controls
          ></audio>
        </AudioPeaks>
      </div>

      <div class="rounded bg-black text-white text-center p-4 mx-4 mb-4 h-20 inline-flex items-center w-full justify-center text-lg font-semibold tracking-wide overflow-hidden">
        {{ previewText || '&nbsp;' }}
      </div>
    </div>

    <div class="pt-4 px-4 h-[calc(100vh-422px)] overflow-auto">
      <div
        class="mb-4 bg-gray-100 p-2 rounded"
        v-for="caption in captions"
        :key="caption.id"
      >
        <div class="font-mono text-xs mb-2">
          <button
            class="box-content border-l-2 border-black text-right bg-gray-300 w-full w-12 px-2 py-1 my-2 rounded hover:bg-sky-300 mx-1"
            @click="setTime(caption, 'start')"
          >
            {{ roundTime(caption.start) }}
          </button>

          <button
            class="box-content border-r-2 border-black text-right bg-gray-300 w-full w-12 px-2 py-1 my-2 rounded hover:bg-sky-300 mx-1"
            @click="setTime(caption, 'end')"
          >
            {{ roundTime(caption.end) }}
          </button>

          <button class="bg-amber-500 text-white px-2 py-1 rounded text-xs ml-8">Merge Up</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded text-xs ml-2">Remove</button>
        </div>

        <textarea
          class="border resize-none rounded px-3 py-2 w-full outline-none"
          v-model="caption.text"
          spellcheck="false"
          @input="save"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<style>
.player[hide-peaks=true] {
  @apply rounded;
  background-color: #f1f3f4;
}

.peaks-controls {
  display: none;
}
</style>