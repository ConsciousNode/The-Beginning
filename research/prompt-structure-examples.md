Construct prompts using this level of detail, structure, and rigor. Not as a blueprint, but as examples of the correct approach to get the desired result. 



#Example 1


**PROMPT:**

Build a complete, fully self-contained single HTML file application: a text-to-speech engine that synthesizes vocal sound entirely from scratch using the Web Audio API. No external libraries. No server. No browser speechSynthesis API. Zero dependencies. Everything in one HTML file.

---

## CORE ARCHITECTURE

The synthesis pipeline is:

```
INPUT TEXT → G2P MODULE (language-specific) → PHONEME SEQUENCE (IPA-mapped) → FORMANT SYNTHESIZER → WEB AUDIO OUTPUT
```

---

## FORMANT SYNTHESIZER

Model the human vocal tract using the source-filter model:

**Voiced sounds (vowels, voiced consonants):**
- Source: OscillatorNode (sawtooth wave), fundamental frequency = pitch (default ~120Hz male, add UI slider for pitch)
- Filter chain: 3 BiquadFilterNodes (bandpass), each tuned to F1, F2, F3 formant frequencies for the target phoneme
- Use known IPA vowel formant tables (F1/F2/F3 in Hz) for all cardinal vowels

**Unvoiced fricatives (s, f, sh, th, h):**
- Source: White noise (AudioBufferSourceNode filled with Math.random())
- Filter: BiquadFilter tuned per fricative

**Plosives (p, b, t, d, k, g):**
- Brief silence (voicing gap) followed by noise burst (filtered white noise, 20-50ms)
- Voiced plosives (b, d, g): add voicing during closure via low-amplitude sawtooth

**Nasals (m, n, ng):**
- Sawtooth source through low-pass filter with nasal pole (~250Hz) and a notch filter (anti-formant)

**Approximants/semivowels (w, j, l, r):**
- Treat as vowel-like, use moving formant values interpolating from consonant target to following vowel

**Coarticulation:**
- CRITICAL: Do NOT snap formant values instantaneously. Linearly interpolate (or use exponentialRampToValueAtTime) F1/F2/F3 between consecutive phoneme targets. Transition time ~40-80ms. This is what makes it sound like speech instead of robot beeps.

**Prosody:**
- Implement a basic pitch contour: slight rise mid-sentence, fall at period/full stop
- Stressed syllables: increase pitch ~15%, increase amplitude ~20%
- Speech rate: UI slider controlling phoneme duration (default ~80ms per phoneme for vowels, ~40ms for consonants)

---

## PHONEME TABLE (IPA core set to implement)

Implement at minimum these phonemes as synthesizer presets (F1/F2/F3 in Hz):

Vowels:
- /a/ (father): F1=800, F2=1200, F3=2500
- /æ/ (cat): F1=700, F2=1800, F3=2600  
- /e/ (bed): F1=600, F2=2000, F3=2800
- /i/ (see): F1=300, F2=2600, F3=3200
- /ɪ/ (bit): F1=400, F2=2000, F3=2600
- /o/ (go): F1=500, F2=900, F3=2500
- /ɔ/ (law): F1=600, F2=800, F3=2500
- /u/ (food): F1=300, F2=800, F3=2300
- /ʊ/ (foot): F1=400, F2=1000, F3=2300
- /ʌ/ (cup): F1=700, F2=1200, F3=2500
- /ə/ (schwa): F1=500, F2=1500, F3=2500
- /ɛ/ (red): F1=580, F2=1800, F3=2600
- /aɪ/ (my): diphthong, glide from /a/ to /ɪ/
- /aʊ/ (now): glide from /a/ to /ʊ/
- /oɪ/ (boy): glide from /ɔ/ to /ɪ/

Consonants: implement synthesis rules for p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, h, tʃ, dʒ, m, n, ŋ, l, r, w, j

---

## G2P MODULES

One module per script/language. Each takes a string and returns an array of phoneme tokens from the IPA set above (or a mapped subset). Implement ALL of the following:

**English:**
- Pronunciation dictionary for the 500 most common English words (hardcode as a JS object)
- Fallback ruleset covering: silent-e, vowel digraphs (ea, oo, ou, etc.), common suffix patterns (-tion → /ʃən/, -ed endings, -ing), consonant clusters
- Handle punctuation: comma = short pause, period/! /? = long pause + pitch drop

**German:**
- Near-phonemic. Rules: w→/v/, v→/f/, z→/ts/, sch→/ʃ/, ch→/x/ (post-back-vowel) or /ç/ (post-front-vowel), ß→/s/, ei→/aɪ/, ie→/i/, eu/äu→/ɔɪ/, au→/aʊ/, ä→/ɛ/, ö→/ø/ (approximate as /ə/), ü→/y/ (approximate as /i/ with rounded lips — shift F2 down slightly), final devoicing (b→p, d→t, g→k at word end)

**Spanish:**
- Highly phonemic. Map each letter directly: a→/a/, e→/e/, i→/i/, o→/o/, u→/u/, ll→/j/, ñ→/nj/, rr→trilled /r/ (approximate as alveolar tap, short /r/ repeat), h is silent, v→/b/, c before e/i→/s/ (or /θ/ for Castilian, default to /s/), qu→/k/, g before e/i→/x/

**French:**
- Final consonants silent (unless liaison). Rules for -tion→/sjɔ̃/, nasalized vowels: an/en→/ɑ̃/, on→/ɔ̃/, in/ain→/ɛ̃/, ou→/u/, eu→/ø/, eau→/o/, ch→/ʃ/, gn→/nj/, j/g(e,i)→/ʒ/

**Italian:**
- Very regular. c before e/i→/tʃ/, g before e/i→/dʒ/, ch→/k/, gh→/g/, sc before e/i→/ʃ/, gli→/ʎ/ (approximate as /lj/), gn→/nj/, double consonants = held slightly longer

**Modern Greek (Latin transcription input OR Greek script):**
- If Greek script: map directly. α→/a/, ε→/e/, η→/i/, ι→/i/, ο→/o/, υ→/i/, ω→/o/, αι→/e/, ει/οι/υι→/i/, αυ→/av/ or /af/, ευ→/ev/ or /ef/, ου→/u/
- Consonants: θ→/θ/, φ→/f/, χ→/x/, ψ→/ps/, ξ→/ks/, γ before front vowels→/j/, μπ→/b/, ντ→/d/, γκ/γγ→/g/

**Russian (Cyrillic):**
- Map Cyrillic letters to phonemes. Vowel reduction: unstressed о→/ə/, unstressed а (pretonic)→/ə/. Palatalization: consonant + ь or front vowel = palatalized version (shift F2 slightly higher on preceding consonant). Key letters: е→/je/ (word-initial) or /e/ palatalized, ё→/jo/, ж→/ʒ/, ш→/ʃ/, щ→/ɕɕ/ (approximate /ʃ/), ч→/tʃ/, ц→/ts/, й→/j/, ъ = hard sign (no sound, marks hard consonant), ы→/ɨ/ (approximate as /ɪ/ with lower F2), э→/ɛ/

**Bulgarian (Cyrillic, simpler than Russian):**
- Similar to Russian mapping but without complex vowel reduction. ъ in Bulgarian = /ə/. Treat as simplified Russian phonology.

**Ukrainian (Cyrillic):**
- Similar to Russian. и→/ɪ/, і→/i/, ї→/ji/, є→/je/, ґ→/g/, г→/ɦ/ (approximate as /h/)

**Japanese Hiragana + Katakana:**
- Pure lookup table. Each mora maps to a CV pair.
- Hiragana and Katakana full tables: あ/ア→/a/, い/イ→/i/, う/ウ→/ɯ/ (approximate /u/ with lower F2), え/エ→/e/, お/オ→/o/
- All ka/ki/ku/ke/ko, sa/si(shi)/su/se/so, ta/chi/tsu/te/to, na/ni/nu/ne/no, ha/hi/fu/he/ho, ma/mi/mu/me/mo, ya/yu/yo, ra/ri/ru/re/ro, wa/wi/we/wo, n(ん/ン)→/n/
- Voiced versions (ga, za, da, ba, pa series) 
- Small っ/ッ = geminate (double length of next consonant)
- Pitch accent: ignore (flat pitch is acceptable for Japanese output)

**Korean (Hangul):**
- Decompose each syllable block into (initial jamo)(vowel jamo)(optional final jamo)
- Initial consonants (초성): ㄱ→/k/, ㄴ→/n/, ㄷ→/t/, ㄹ→/r/, ㅁ→/m/, ㅂ→/p/, ㅅ→/s/, ㅇ→silent, ㅈ→/tʃ/, ㅊ→/tʃh/, ㅋ→/kh/, ㅌ→/th/, ㅍ→/ph/, ㅎ→/h/, ㄲ→/k'/, ㄸ→/t'/, ㅃ→/p'/, ㅆ→/s'/, ㅉ→/tʃ'/
- Vowels (중성): ㅏ→/a/, ㅐ→/e/, ㅑ→/ja/, ㅒ→/je/, ㅓ→/ɛ/, ㅔ→/e/, ㅕ→/jɛ/, ㅖ→/je/, ㅗ→/o/, ㅘ→/wa/, ㅙ→/we/, ㅚ→/ø/(→/e/), ㅛ→/jo/, ㅜ→/u/, ㅝ→/wɛ/, ㅞ→/we/, ㅟ→/y/(→/wi/), ㅠ→/ju/, ㅡ→/ɯ/(→/ɪ/), ㅢ→/ɰi/(→/i/), ㅣ→/i/
- Final consonants (종성): ㄱ→/k̚/, ㄴ→/n/, ㄷ→/t̚/, ㄹ→/l/, ㅁ→/m/, ㅂ→/p̚/, ㅇ→/ŋ/
- Implement basic resyllabification: if final jamo followed by ㅇ initial, final jamo moves to initial position of next syllable

**Auto-detect script:** Examine the Unicode ranges in the input text and select the appropriate G2P module automatically, or allow manual selection via dropdown.

---

## UI

Clean dark-theme single page app. Sections:

**Header:** App name "PhonForge" (or similar), language selector dropdown (Auto-detect + all languages listed), voice pitch slider (80–220Hz), speech rate slider (0.5x–2x), a "voice character" toggle (Male/Female — female shifts all formant frequencies up ~15%)

**Input panel:** 
- Large textarea for typed input
- "Load File" button accepting .txt, .md, .html (strips tags), .srt subtitle files
- Character/word count display

**Controls:** 
- Play button (synthesizes and plays entire text)
- Stop button
- "Read Selection" button (plays only selected text in textarea)
- Progress bar showing playback position through text, with current word highlighted in the textarea

**Visualizer:** Small oscilloscope/waveform display (AnalyserNode → canvas, same pattern as Chromatrack)

**Phoneme Debug Panel** (collapsible): Shows the raw phoneme sequence output for any selected text — useful for debugging G2P rules. Format: `"hello" → [h ɛ l oʊ]`

---

## TECHNICAL NOTES

- Use AudioContext, resume on first user gesture
- Schedule phonemes using audioCtx.currentTime lookahead — do NOT use setTimeout for audio timing
- Buffer the entire phoneme sequence before playback, calculate total duration, then schedule all audio nodes at precise offsets
- Pause/resume: track currentTime offset, cancel scheduled nodes, resume from phoneme index
- File reading: FileReader API for .txt/.md, DOMParser for .html, custom parser for .srt (strip timestamps)
- Single <script> tag, single <style> tag, everything inline

---

## QUALITY BAR

The goal is intelligible speech. It will sound robotic — that is acceptable and expected. The benchmark is DECtalk circa 1984: clearly understandable, recognizably speech, with distinct phoneme identity. Japanese and Korean will sound the best due to regular mora structure. English will sound the most robotic due to irregular phonology. That is fine.

Do not use any placeholder functions. Do not stub out the G2P modules. Implement every language completely. The entire app must work on first load with no modifications.

Output: one complete HTML file, nothing else.

---

#Example 2

You previously built a formant speech synthesizer in a single HTML file. I am giving you the full source code. Apply the following specific changes. Do not rewrite the whole file — make surgical edits to fix the listed issues, then output the complete corrected file.
Change 1: Rename the app
Replace every occurrence of "PhonForge" with "Webster". Update the <title> tag to Webster — Formant Speech Synthesizer. Replace the music note SVG brand icon with a waveform/speech icon (a simple horizontal waveform SVG, not a music note).
Change 2: Expand the English dictionary
The current ENG_DICT has 20 entries. Replace it entirely with the 500 most common English words, each mapped to correct IPA phoneme strings using the same space-separated format already in use (e.g. "the":"ð ə"). Include common function words, verbs, nouns, adjectives. Use standard American English pronunciation. The dictionary is the single biggest intelligibility improvement for English text.
Change 3: Fix Italian double consonant handling
Current code at the Italian G2P (the if (c === next) i++ section) pushes one consonant and skips the second, treating doubles as singles. Change this to push the consonant twice (geminate) and then increment i to skip the duplicate. So pp → push p, push p, advance i.
Change 4: Fix German final devoicing
Current final devoicing only checks t[i+1]===' ' || !t[i+1]. Change it to also trigger when t[i+1] is a punctuation character (',', '.', '!', '?'). The check should be: (!t[i+1] || t[i+1] === ' ' || /[.,!?]/.test(t[i+1])).
Change 5: Fix progress tracking
Current progress uses setTimeout(() => { if (this.isPlaying) onProgress(i, phonemeSeq.length); }, (time - this.ctx.currentTime) * 1000) inside the phoneme loop. This fires N setTimeout calls, one per phoneme, which is unreliable at high speech rates. Replace this with a visual queue approach: create a this.visualQueue = [] array on the synth. Instead of setTimeout, push { triggerTime: time, idx: i, total: phonemeSeq.length } entries to this queue during scheduling. In the drawVisualizer animation loop, drain the queue: for each entry where this.synth.ctx.currentTime >= entry.triggerTime, call onProgress(entry.idx, entry.total) and remove from queue. Keep the onComplete setTimeout as-is (it's a single call, acceptable).
Change 6: Add missing katakana compound mora
The Japanese kana table covers basic mora but is missing the compound mora (combination characters like きゃ/キャ, しゃ/シャ etc.). Add these to the kana lookup table:
きゃ/キャ → k j a, きゅ/キュ → k j u, きょ/キョ → k j o
しゃ/シャ → ʃ a, しゅ/シュ → ʃ u, しょ/ショ → ʃ o
ちゃ/チャ → t ʃ a, ちゅ/チュ → t ʃ u, ちょ/チョ → t ʃ o
にゃ/ニャ → n j a, にゅ/ニュ → n j u, にょ/ニョ → n j o
ひゃ/ヒャ → h j a, ひゅ/ヒュ → h j u, ひょ/ヒョ → h j o
みゃ/ミャ → m j a, みゅ/ミュ → m j u, みょ/ミョ → m j o
りゃ/リャ → r j a, りゅ/リュ → r j u, りょ/リョ → r j o
ぎゃ/ギャ → g j a, ぎゅ/ギュ → g j u, ぎょ/ギョ → g j o
じゃ/ジャ → ʒ a, じゅ/ジュ → ʒ u, じょ/ジョ → ʒ o
びゃ/ビャ → b j a, びゅ/ビュ → b j u, びょ/ビョ → b j o
ぴゃ/ピャ → p j a, ぴゅ/ピュ → p j u, ぴょ/ピョ → p j o
In the Japanese G2P loop, check for two-character sequences (current char + next char) before checking single chars. The katakana versions should be converted to hiragana first using the existing unicode shift, then looked up.
Change 7: Improve the っ/ッ geminate handling
Currently a small tsu (っ/ッ) just pushes a silence _. Instead, peek at the following kana, extract its first consonant phoneme, and push that phoneme before the following mora begins. This creates the audible "stop" quality of geminate consonants. If the following character is not in the kana table or is unknown, fall back to _.
Do not change anything else. Output the complete corrected single HTML file.

---

#Example 3



## ITERATION PROMPT:

---

You are fixing two specific bugs in this single-file HTML formant speech synthesizer. Do not rewrite unrelated code. Make only the changes described. Output the complete corrected file.

**Bug Fix 1: Volume envelope is a triangle — fix it**

In the `playSequence` method, the current code does:
```js
let time = this.ctx.currentTime + 0.1;
this.masterGain.gain.setValueAtTime(0, time);
this.masterGain.gain.linearRampToValueAtTime(1.5, time + 0.05);
// ... phoneme loop ...
this.masterGain.gain.linearRampToValueAtTime(0, time); // 'time' is now end of utterance
```

This creates a triangle envelope: gain rises to 1.5 in 50ms then falls linearly to 0 over the entire utterance. Replace the gain scheduling with this pattern:

```js
const startTime = this.ctx.currentTime + 0.1;
let time = startTime;

this.masterGain.gain.cancelScheduledValues(startTime);
this.masterGain.gain.setValueAtTime(0, startTime);
this.masterGain.gain.linearRampToValueAtTime(1.5, startTime + 0.05);
this.masterGain.gain.setValueAtTime(1.5, startTime + 0.06); // lock it here
```

Then at the end, after the phoneme loop, replace `this.masterGain.gain.linearRampToValueAtTime(0, time)` with:
```js
this.masterGain.gain.setValueAtTime(1.5, time - 0.001);
this.masterGain.gain.linearRampToValueAtTime(0, time + 0.15);
```

And update the onComplete setTimeout to fire at `(time + 0.15 - this.ctx.currentTime) * 1000` to match.

---

**Bug Fix 2: Formant smearing and consonant bleed — fix both causes**

**2a — Add parameter anchors at each phoneme boundary.**

At the very start of each phoneme's slot in the forEach loop, before scheduling any ramps, add explicit `setValueAtTime` calls that lock the current automation position. This prevents ramps from starting mid-interpolation from a prior phoneme's unfinished ramp:

```js
// Anchor current values at start of this phoneme slot
this.voicedSource.frequency.setValueAtTime(pitchContour[i > 0 ? i-1 : 0], time);
this.voicedGain.gain.setValueAtTime(this.voicedGain.gain.value, time); // NOT this - see below
```

Actually do it this way — before the ramps, set anchors using the PREVIOUS phoneme's target values (track them in variables `prevF1`, `prevF2`, `prevF3`, `prevVGain` initialized before the loop):

```js
// Before the forEach, initialize:
let prevF1 = (PHONEMES[phonemeSeq[0]]?.f1 || 500) * formantShift;
let prevF2 = (PHONEMES[phonemeSeq[0]]?.f2 || 1500) * formantShift;
let prevF3 = (PHONEMES[phonemeSeq[0]]?.f3 || 2500) * formantShift;
let prevVGain = 0;

// Inside the forEach, at the very start of each iteration:
this.f1.frequency.setValueAtTime(prevF1, time);
this.f2.frequency.setValueAtTime(prevF2, time);
this.f3.frequency.setValueAtTime(prevF3, time);
this.voicedGain.gain.setValueAtTime(prevVGain, time);

// At the end of each iteration, update prevs:
prevF1 = tF1 > 0 ? tF1 : prevF1;
prevF2 = tF2 > 0 ? tF2 : prevF2;
prevF3 = tF3 > 0 ? tF3 : prevF3;
prevVGain = tVGain;
```

**2b — Neutralize formants during silence and plosive closure.**

Currently when `tF1 === 0` (silence, plosive), no formant ramps are scheduled and filters keep ringing at the previous vowel's frequency. Add an else clause: when tF1 is 0 AND the phoneme type is 'silence' or plosive closure, ramp formants toward a neutral schwa position:

Change the formant ramp section from:
```js
if (tF1 > 0) this.f1.frequency.linearRampToValueAtTime(tF1, time + transitionTime);
if (tF2 > 0) this.f2.frequency.linearRampToValueAtTime(tF2, time + transitionTime);
if (tF3 > 0) this.f3.frequency.linearRampToValueAtTime(tF3, time + transitionTime);
```

To:
```js
const neutralF1 = 500 * formantShift;
const neutralF2 = 1500 * formantShift;
const neutralF3 = 2500 * formantShift;

if (tF1 > 0) {
    this.f1.frequency.linearRampToValueAtTime(tF1, time + transitionTime);
    this.f2.frequency.linearRampToValueAtTime(tF2, time + transitionTime);
    this.f3.frequency.linearRampToValueAtTime(tF3, time + transitionTime);
} else if (pData.type === 'silence' || pData.type.includes('plosive')) {
    // Neutralize toward schwa during closure/silence
    this.f1.frequency.linearRampToValueAtTime(neutralF1, time + transitionTime);
    this.f2.frequency.linearRampToValueAtTime(neutralF2, time + transitionTime);
    this.f3.frequency.linearRampToValueAtTime(neutralF3, time + transitionTime);
}
```

**2c — Increase consonant/silence duration slightly.**

The current phoneme durations are very short. This causes consonants to smear into adjacent vowels. In the PHONEMES table, increase durations:
- All plosives (p, b, t, d, k, g): change `dur` from 60 to 80
- All fricatives (s, z, ʃ, ʒ, f, v, θ, ð, h, x): change `dur` from 60-90 to 90-110 (add 20ms to each)
- Silence `_`: change from 50 to 70
- Comma `,`: keep at 150
- Period `.`: change to 350

**2d — Reduce coarticulation transition ratio.**

Change `let transitionTime = dur * 0.4` to `let transitionTime = dur * 0.25`. 40% overlap was too aggressive and was smearing adjacent phonemes too hard. 25% gives cleaner separation while preserving smooth transitions.

---

Output the complete corrected single HTML file.

---

#Example 4

ITERATION PROMPT:
You are making targeted additions and fixes to the Webster formant speech synthesizer HTML file. Apply all changes below. Do not rewrite unrelated sections. Output the complete corrected file.
Fix 1: Fricative tail bleed ("paper sliding" s sound)
In the playSequence forEach loop, find the fricative scheduling block:
if (pData.type.includes('fricative')) {
    this.noiseFilter.frequency.setValueAtTime(tNFreq, time);
    this.noiseGain.gain.linearRampToValueAtTime(tNGain, time + transitionTime);
} else {
    this.noiseGain.gain.linearRampToValueAtTime(0, time + transitionTime * 0.5);
}
Replace it with:
if (pData.type.includes('fricative')) {
    this.noiseFilter.frequency.setValueAtTime(tNFreq, time);
    this.noiseGain.gain.linearRampToValueAtTime(tNGain, time + transitionTime);
    // Hard cutoff at END of fricative slot — prevents hiss bleeding into next phoneme
    this.noiseGain.gain.setValueAtTime(tNGain, time + dur * 0.85);
    this.noiseGain.gain.linearRampToValueAtTime(0, time + dur * 0.98);
} else {
    this.noiseGain.gain.setValueAtTime(0, time);
    this.noiseGain.gain.linearRampToValueAtTime(0, time + transitionTime * 0.5);
}
Also in the PHONEMES table, change the s noiseFilter Q (in the constructor) from this.noiseFilter.type = 'bandpass'; this.noiseFilter.Q.value = 1 to this.noiseFilter.Q.value = 2.5. This makes /s/ slightly more focused and less hissy.
Fix 2: Word clipping — increase base durations
In the PHONEMES table, make these duration changes:
All vowels (a, æ, e, i, ɪ, o, ɔ, u, ʊ, ʌ, ə, ɛ, ø, y, ɨ): increase dur by 25 (e.g. 80→105, 70→95, 60→85, 50→75)
Nasal vowels (ɑ̃, ɔ̃, ɛ̃): increase from 90 to 115
Approximants (w, j, l, r, ʎ): increase from 50-60 to 75
Nasals (m, n, ŋ, ɲ): increase from 70 to 90
Word gap _: increase from 70 to 110
Keep comma and period as-is
Fix 3: Number expansion pre-processing
Add a NumberExpander object before the G2P object. It handles digit sequences in text before G2P runs. Each language gets its own number-to-words function. Implement the following:
const NumberExpander = {

    expand(text, lang) {
        // Replace digit sequences (including decimals) with spoken words
        return text.replace(/\d+(\.\d+)?/g, (match) => {
            const isDecimal = match.includes('.');
            if (isDecimal) {
                const [intPart, fracPart] = match.split('.');
                return this.toWords(parseInt(intPart), lang) + ' ' + this.decimalSep(lang) + ' ' + fracPart.split('').map(d => this.toWords(parseInt(d), lang)).join(' ');
            }
            return this.toWords(parseInt(match), lang);
        });
    },

    decimalSep(lang) {
        const seps = { en:'point', de:'Komma', fr:'virgule', es:'coma', it:'virgola', ru:'целых', ja:'てん', ko:'점', el:'κόμμα', bg:'цяло', uk:'ціла' };
        return seps[lang] || 'point';
    },

    toWords(n, lang) {
        if (n < 0) return this.negative(lang) + ' ' + this.toWords(-n, lang);
        if (n === 0) return this.zero(lang);
        switch(lang) {
            case 'de': return this.german(n);
            case 'es': return this.spanish(n);
            case 'fr': return this.french(n);
            case 'it': return this.italian(n);
            case 'ru': case 'bg': case 'uk': return this.russian(n);
            case 'el': return this.greek(n);
            case 'ja': return this.japanese(n);
            case 'ko': return this.korean(n);
            default:   return this.english(n);
        }
    },

    negative(lang) {
        const neg = { en:'negative', de:'minus', es:'menos', fr:'moins', it:'meno', ru:'минус', el:'μείον', ja:'マイナス', ko:'마이너스' };
        return neg[lang] || 'negative';
    },

    zero(lang) {
        const z = { en:'zero', de:'null', es:'cero', fr:'zéro', it:'zero', ru:'ноль', el:'μηδέν', ja:'ゼロ', ko:'영' };
        return z[lang] || 'zero';
    },

    english(n) {
        const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
        const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? '-' + ones[n%10] : '');
        if (n < 1000) return ones[Math.floor(n/100)] + ' hundred' + (n%100 ? ' ' + this.english(n%100) : '');
        if (n < 1000000) return this.english(Math.floor(n/1000)) + ' thousand' + (n%1000 ? ' ' + this.english(n%1000) : '');
        if (n < 1000000000) return this.english(Math.floor(n/1000000)) + ' million' + (n%1000000 ? ' ' + this.english(n%1000000) : '');
        return this.english(Math.floor(n/1000000000)) + ' billion' + (n%1000000000 ? ' ' + this.english(n%1000000000) : '');
    },

    german(n) {
        const ones = ['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
        const tens = ['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];
        if (n < 20) return ones[n];
        if (n < 100) return (n%10 ? ones[n%10] + 'und' : '') + tens[Math.floor(n/10)];
        if (n < 1000) return ones[Math.floor(n/100)] + 'hundert' + (n%100 ? this.german(n%100) : '');
        if (n < 1000000) return this.german(Math.floor(n/1000)) + 'tausend' + (n%1000 ? this.german(n%1000) : '');
        return this.german(Math.floor(n/1000000)) + ' Million' + (n%1000000 ? ' ' + this.german(n%1000000) : '');
    },

    spanish(n) {
        const ones = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
        const tens = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
        const hundreds = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
        if (n < 20) return ones[n];
        if (n < 30) return 'veinti' + ones[n%10];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' y ' + ones[n%10] : '');
        if (n === 100) return 'cien';
        if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 ? ' ' + this.spanish(n%100) : '');
        if (n < 1000000) return this.spanish(Math.floor(n/1000)) + ' mil' + (n%1000 ? ' ' + this.spanish(n%1000) : '');
        return this.spanish(Math.floor(n/1000000)) + ' millón' + (n%1000000 ? ' ' + this.spanish(n%1000000) : '');
    },

    french(n) {
        const ones = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
        const tens = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
        if (n < 20) return ones[n];
        if (n < 70) return tens[Math.floor(n/10)] + (n%10 ? (Math.floor(n/10)===2 && n%10===1 ? ' et ' : '-') + ones[n%10] : '');
        if (n < 80) return 'soixante-' + this.french(n-60);
        if (n < 100) return 'quatre-vingt' + (n===80?'s':'-' + this.french(n-80));
        if (n < 1000) return ones[Math.floor(n/100)] + ' cent' + (n%100 ? ' ' + this.french(n%100) : 's');
        if (n < 1000000) return this.french(Math.floor(n/1000)) + ' mille' + (n%1000 ? ' ' + this.french(n%1000) : '');
        return this.french(Math.floor(n/1000000)) + ' million' + (n%1000000 ? ' ' + this.french(n%1000000) : '');
    },

    italian(n) {
        const ones = ['','uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove'];
        const tens = ['','','venti','trenta','quaranta','cinquanta','sessanta','settanta','ottanta','novanta'];
        if (n < 20) return ones[n];
        if (n < 100) {
            let t = tens[Math.floor(n/10)];
            let o = ones[n%10];
            if (o && (o[0]==='a'||o[0]==='o'||o[0]==='u'||o[0]==='e'||o[0]==='i')) t = t.slice(0,-1);
            return t + (o||'');
        }
        if (n < 1000) return (Math.floor(n/100)===1?'':ones[Math.floor(n/100)]) + 'cento' + (n%100 ? this.italian(n%100) : '');
        if (n < 1000000) return (Math.floor(n/1000)===1?'':this.italian(Math.floor(n/1000))) + 'mila' + (n%1000 ? this.italian(n%1000) : '');
        return this.italian(Math.floor(n/1000000)) + ' milioni' + (n%1000000 ? ' ' + this.italian(n%1000000) : '');
    },

    russian(n) {
        const ones = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
        const tens = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
        const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
        if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 ? ' ' + this.russian(n%100) : '');
        if (n < 1000000) return this.russian(Math.floor(n/1000)) + ' тысяч' + (n%1000 ? ' ' + this.russian(n%1000) : '');
        return this.russian(Math.floor(n/1000000)) + ' миллион' + (n%1000000 ? ' ' + this.russian(n%1000000) : '');
    },

    greek(n) {
        const ones = ['','ένα','δύο','τρία','τέσσερα','πέντε','έξι','επτά','οκτώ','εννέα','δέκα','έντεκα','δώδεκα','δεκατρία','δεκατέσσερα','δεκαπέντε','δεκαέξι','δεκαεπτά','δεκαοκτώ','δεκαεννέα'];
        const tens = ['','','είκοσι','τριάντα','σαράντα','πενήντα','εξήντα','εβδομήντα','ογδόντα','ενενήντα'];
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
        if (n < 1000) return (Math.floor(n/100)===1?'εκατό':'εκατόν') + (n%100 ? ' ' + this.greek(n%100) : '');
        if (n < 1000000) return this.greek(Math.floor(n/1000)) + ' χίλια' + (n%1000 ? ' ' + this.greek(n%1000) : '');
        return this.greek(Math.floor(n/1000000)) + ' εκατομμύριο' + (n%1000000 ? ' ' + this.greek(n%1000000) : '');
    },

    japanese(n) {
        const ones = ['','一','二','三','四','五','六','七','八','九'];
        if (n < 10) return ones[n];
        if (n < 20) return '十' + (n%10 ? ones[n%10] : '');
        if (n < 100) return ones[Math.floor(n/10)] + '十' + (n%10 ? ones[n%10] : '');
        if (n < 1000) return ones[Math.floor(n/100)] + '百' + (n%100 ? this.japanese(n%100) : '');
        if (n < 10000) return ones[Math.floor(n/1000)] + '千' + (n%1000 ? this.japanese(n%1000) : '');
        if (n < 100000000) return this.japanese(Math.floor(n/10000)) + '万' + (n%10000 ? this.japanese(n%10000) : '');
        return this.japanese(Math.floor(n/100000000)) + '億' + (n%100000000 ? this.japanese(n%100000000) : '');
    },

    korean(n) {
        const ones = ['','일','이','삼','사','오','육','칠','팔','구'];
        if (n < 10) return ones[n];
        if (n < 20) return '십' + (n%10 ? ones[n%10] : '');
        if (n < 100) return ones[Math.floor(n/10)] + '십' + (n%10 ? ones[n%10] : '');
        if (n < 1000) return ones[Math.floor(n/100)] + '백' + (n%100 ? this.korean(n%100) : '');
        if (n < 10000) return ones[Math.floor(n/1000)] + '천' + (n%1000 ? this.korean(n%1000) : '');
        if (n < 100000000) return this.korean(Math.floor(n/10000)) + '만' + (n%10000 ? this.korean(n%10000) : '');
        return this.korean(Math.floor(n/100000000)) + '억' + (n%100000000 ? this.korean(n%100000000) : '');
    }
};
In processText(), add number expansion as the first step before G2P dispatch:
processText(text) {
    let lang = document.getElementById('lang-select').value;
    if (lang === 'auto') lang = this.detectLanguage(text);
    
    // Expand numbers before G2P
    text = NumberExpander.expand(text, lang);
    
    // ... rest of existing switch/G2P dispatch unchanged
Feature: Expanded voice controls + preset voices
In the right panel, replace the current Voice Character section (the Male/Female toggle buttons) with this expanded voice control section. Keep pitch and rate sliders as-is below it.
Add a VOICE_PRESETS object in the script:
const VOICE_PRESETS = {
    'narrator': { name:'Narrator', pitch:115, rate:0.9, formantScale:1.0, brightness:1.0, roughness:0.0 },
    'female':   { name:'Female',   pitch:185, rate:1.0, formantScale:1.18, brightness:1.05, roughness:0.0 },
    'child':    { name:'Child',    pitch:240, rate:1.1, formantScale:1.3, brightness:1.1, roughness:0.0 },
    'elder':    { name:'Elder',    pitch:95,  rate:0.85, formantScale:0.95, brightness:0.9, roughness:0.15 },
    'robot':    { name:'Robot',    pitch:100, rate:1.0, formantScale:1.0, brightness:1.3, roughness:0.4 },
    'whisper':  { name:'Whisper',  pitch:90,  rate:0.8, formantScale:1.0, brightness:0.7, roughness:0.0 },
    'hal':      { name:'HAL 9000', pitch:88,  rate:0.75, formantScale:0.92, brightness:0.85, roughness:0.05 },
};
Replace the HTML voice character section with:
<div class="control-group">
    <label>Voice Preset</label>
    <select id="voice-preset">
        <option value="narrator">Narrator (Default)</option>
        <option value="female">Female</option>
        <option value="child">Child</option>
        <option value="elder">Elder</option>
        <option value="robot">Robot</option>
        <option value="whisper">Whisper</option>
        <option value="hal">HAL 9000</option>
        <option value="custom">Custom</option>
    </select>
</div>

<div class="control-group">
    <label>Pitch (Hz)</label>
    <div class="slider-row">
        <input type="range" id="pitch-slider" min="60" max="300" value="115">
        <span class="slider-val" id="pitch-val">115</span>
    </div>
</div>

<div class="control-group">
    <label>Speech Rate</label>
    <div class="slider-row">
        <input type="range" id="rate-slider" min="0.5" max="2.5" step="0.1" value="1.0">
        <span class="slider-val" id="rate-val">1.0x</span>
    </div>
</div>

<div class="control-group">
    <label>Formant Scale</label>
    <div class="slider-row">
        <input type="range" id="formant-slider" min="0.7" max="1.5" step="0.01" value="1.0">
        <span class="slider-val" id="formant-val">1.00</span>
    </div>
</div>

<div class="control-group">
    <label>Brightness</label>
    <div class="slider-row">
        <input type="range" id="brightness-slider" min="0.5" max="2.0" step="0.05" value="1.0">
        <span class="slider-val" id="brightness-val">1.00</span>
    </div>
</div>

<div class="control-group">
    <label>Roughness (Vocal Fry)</label>
    <div class="slider-row">
        <input type="range" id="roughness-slider" min="0" max="1" step="0.05" value="0">
        <span class="slider-val" id="roughness-val">0.00</span>
    </div>
</div>
In the JS app.init(), add event listeners for all new sliders and the preset select:
document.getElementById('voice-preset').addEventListener('change', (e) => {
    const p = VOICE_PRESETS[e.target.value];
    if (!p) return; // 'custom' — do nothing
    document.getElementById('pitch-slider').value = p.pitch;
    document.getElementById('pitch-val').innerText = p.pitch;
    document.getElementById('rate-slider').value = p.rate;
    document.getElementById('rate-val').innerText = p.rate.toFixed(1) + 'x';
    document.getElementById('formant-slider').value = p.formantScale;
    document.getElementById('formant-val').innerText = p.formantScale.toFixed(2);
    document.getElementById('brightness-slider').value = p.brightness;
    document.getElementById('brightness-val').innerText = p.brightness.toFixed(2);
    document.getElementById('roughness-slider').value = p.roughness;
    document.getElementById('roughness-val').innerText = p.roughness.toFixed(2);
});

['formant-slider','brightness-slider','roughness-slider'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        const displayId = id.replace('slider','val');
        document.getElementById(displayId).innerText = parseFloat(e.target.value).toFixed(2);
        document.getElementById('voice-preset').value = 'custom';
    });
});

// Also set pitch/rate sliders to switch preset to 'custom' on manual change
['pitch-slider','rate-slider'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        document.getElementById('voice-preset').value = 'custom';
    });
});
Remove the old setVoice() method and references to btn-male/btn-female.
In the play() method, update config to pull new values:
const config = {
    pitch: parseInt(document.getElementById('pitch-slider').value),
    rate: parseFloat(document.getElementById('rate-slider').value),
    formantScale: parseFloat(document.getElementById('formant-slider').value),
    brightness: parseFloat(document.getElementById('brightness-slider').value),
    roughness: parseFloat(document.getElementById('roughness-slider').value),
};
In playSequence(), replace isFemale/formantShift with the new params:
const formantShift = config.formantScale;
const brightness = config.brightness;
const roughness = config.roughness;
Apply brightness by multiplying all noiseFreq values by brightness when scheduling noiseFilter.frequency. Apply roughness as amplitude modulation: create a low-frequency (8Hz) oscillator that wobbles voicedGain.gain by roughness * 0.3. This should be set up in the constructor as a this.roughnessLFO OscillatorNode (type: 'square', freq: 8) connected through a this.roughnessGain GainNode to... actually, the simplest implementation: multiply tVGain by (1 - roughness * 0.4) to reduce clean voicing, and increase noise contribution on voiced phonemes by roughness * 0.2 added to tNGain. This simulates vocal fry without needing another oscillator.
Feature: Help Modal
Add a ? help button in the header right side (before the language select). In HTML, add to header:
<button class="secondary" id="btn-help" style="padding: 6px 12px; font-size: 0.9rem;">? Help</button>
Add a modal overlay to the body (before the closing </body>):
<div id="help-modal" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;">
  <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:2rem;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">
    <button onclick="document.getElementById('help-modal').classList.add('hidden')" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button>
    <h2 style="margin-bottom:1rem;color:var(--accent);">Webster — Formant Speech Synthesizer</h2>
    <p style="color:var(--text-muted);margin-bottom:1.5rem;">Webster synthesizes speech from scratch using the Web Audio API. No browser TTS. No internet. No server. It models the human vocal tract using formant filters — just like early speech synthesizers of the 1970s–80s.</p>
    
    <h3 style="margin-bottom:0.5rem;">How to Use</h3>
    <p style="color:var(--text-muted);margin-bottom:1rem;">Type or paste text into the input area and press <strong>Play</strong>. Use <strong>Read Selection</strong> to synthesize only highlighted text. Load .txt, .md, .html, or .srt files with <strong>Load File</strong>.</p>

    <h3 style="margin-bottom:0.5rem;">Languages Supported</h3>
    <p style="color:var(--text-muted);margin-bottom:1rem;">English, German, Spanish, French, Italian, Modern Greek, Russian, Bulgarian, Ukrainian, Japanese (Hiragana/Katakana), Korean (Hangul). Auto-detect works for most scripts. Numbers are automatically spoken in the selected language.</p>

    <h3 style="margin-bottom:0.5rem;">Voice Controls</h3>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;"><strong>Preset</strong> — loads a named voice profile. Choose Custom to mix your own.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;"><strong>Pitch</strong> — fundamental frequency of the voice (Hz). Higher = lighter voice.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;"><strong>Rate</strong> — speech speed multiplier. 1.0x is normal.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;"><strong>Formant Scale</strong> — scales resonant frequencies of the vocal tract. Higher = smaller perceived mouth/throat.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;"><strong>Brightness</strong> — scales fricative filter frequencies. Higher = sharper sibilants.</p>
    <p style="color:var(--text-muted);margin-bottom:1rem;"><strong>Roughness</strong> — adds vocal fry character by reducing clean voicing. Simulates an older or rougher voice.</p>

    <h3 style="margin-bottom:0.5rem;">Tips</h3>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;">• Punctuation matters: commas pause briefly, periods pause longer.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;">• Japanese and Korean sound the most natural due to their regular phonemic structure.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;">• The Phoneme Debug panel shows exactly what sounds are being synthesized.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;">• HAL 9000 preset + slow rate + long text is the correct use of this tool.</p>
    <p style="color:var(--text-muted);margin-bottom:0.5rem;">• Webster is entirely offline. Nothing leaves your browser.</p>
    <p style="color:var(--text-muted);">• Built with the Web Audio API. One HTML file. No dependencies.</p>
  </div>
</div>
Add in init():
document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
});
document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('help-modal'))
        document.getElementById('help-modal').classList.add('hidden');
});
Output the complete corrected single HTML file.

---

#Example 5

PROMPT:
You are making targeted fixes to the Webster formant speech synthesizer. Apply all changes below exactly. Do not rewrite unrelated code. Output the complete corrected file.
Fix 1 — Stale setTimeout kills playback mid-session
In the FormantSynth class, add a session counter to prevent stale onComplete callbacks from stopping active playback.
In the constructor, add: this.sessionId = 0;
In playSequence, immediately after this.isPlaying = true;, add:
this.sessionId++;
const mySession = this.sessionId;
Change the onComplete setTimeout at the end of playSequence from:
setTimeout(() => {
    if (this.isPlaying) onComplete();
}, (time + 0.15 - this.ctx.currentTime) * 1000);
To:
setTimeout(() => {
    if (this.isPlaying && this.sessionId === mySession) onComplete();
}, (time + 0.15 - this.ctx.currentTime) * 1000);
Fix 2 — Add missing words to ENG_DICT
Add the following entries to the ENG_DICT object. These are the words causing the reported mispronunciations plus essential tech vocabulary:
"hello":"h ɛ l o",
"speech":"s p i t ʃ",
"synthesizer":"s ɪ n θ ɛ s a ɪ z ə r",
"entirely":"ɪ n t a ɪ ə r l i",
"browser":"b r a ʊ z ə r",
"using":"j u z ɪ ŋ",
"used":"j u z d",
"uses":"j u z ɪ z",
"web":"w ɛ b",
"audio":"ɔ d i o",
"api":"e ɪ p i a ɪ",
"models":"m a d ə l z",
"model":"m a d ə l",
"human":"h j u m ə n",
"vocal":"v o k ə l",
"tract":"t r æ k t",
"generate":"d ʒ ɛ n ə r e ɪ t",
"generates":"d ʒ ɛ n ə r e ɪ t s",
"generated":"d ʒ ɛ f ə r e ɪ t ɪ d",
"scratch":"s k r æ t ʃ",
"formant":"f ɔ r m ə n t",
"formants":"f ɔ r m ə n t s",
"running":"r ʌ n ɪ ŋ",
"browser":"b r a ʊ z ə r",
"browsers":"b r a ʊ z ə r z",
"entirely":"ɪ n t a ɪ ə r l i",
"vocal":"v o k ə l",
"browser":"b r a ʊ z ə r",
"hello":"h ɛ l o",
"world":"w ə r l d",
"synthesize":"s ɪ n θ ɛ s a ɪ z",
"synthesis":"s ɪ n θ ɛ s ɪ s",
"phoneme":"f o n i m",
"phonemes":"f o n i m z",
"frequency":"f r i k w ə n s i",
"frequencies":"f r i k w ə n s i z",
"oscillator":"a s ɪ l e ɪ t ə r",
"filter":"f ɪ l t ə r",
"filters":"f ɪ l t ə r z",
"vowel":"v a ʊ ə l",
"consonant":"k a n s ə n ə n t",
"language":"l æ ŋ g w ɪ d ʒ",
"languages":"l æ ŋ g w ɪ d ʒ ɪ z",
"browser":"b r a ʊ z ə r",
"vocal":"v o k ə l",
"tract":"t r æ k t",
"scratch":"s k r æ t ʃ",
"script":"s k r ɪ p t",
"pitch":"p ɪ t ʃ",
"voice":"v ɔ ɪ s",
"voices":"v ɔ ɪ s ɪ z",
"noise":"n ɔ ɪ z",
"wave":"w e ɪ v",
"waveform":"w e ɪ v f ɔ r m",
"offline":"a f l a ɪ n",
"server":"s ə r v ə r",
"signal":"s ɪ g n ə l",
"digital":"d ɪ d ʒ ɪ t ə l",
"analog":"æ n ə l a g",
"output":"a ʊ t p ʊ t",
"input":"ɪ n p ʊ t",
"buffer":"b ʌ f ə r",
"sample":"s æ m p ə l",
"rate":"r e ɪ t",
"gain":"g e ɪ n",
"context":"k a n t ɛ k s t",
"node":"n o d",
"nodes":"n o d z"
Fix 3 — Context-sensitive "the" and "a" article pronunciation in English G2P
The English G2P currently treats all words identically regardless of context. Replace the G2P.english function with this version that applies two context rules:
"the" before a vowel-initial word → /ði/ (thee), otherwise /ðə/ (thuh)
"a" (article) before a vowel-initial word → /e ɪ/ (ay), otherwise /ə/ (uh)
english: (text) => {
    const VOWEL_INITIALS = new Set(['a','e','i','o','u','æ','ɛ','ɪ','ɔ','ʌ','ə']);
    
    let words = text.toLowerCase().match(/[\w']+|[.,!?]/g) || [];
    let phonemes = [];
    
    words.forEach((w, wi) => {
        if (w === ',' || w === '.' || w === '!' || w === '?') {
            phonemes.push(w === ',' ? ',' : '.'); return;
        }
        
        // Context-sensitive articles
        if (w === 'the' || w === 'a') {
            // Find next real word
            let nextWord = null;
            for (let ni = wi + 1; ni < words.length; ni++) {
                if (words[ni] && !/^[.,!?]$/.test(words[ni])) { nextWord = words[ni]; break; }
            }
            let nextStartsWithVowel = false;
            if (nextWord) {
                // Check first phoneme of next word
                const nextPhonemes = ENG_DICT[nextWord] ? ENG_DICT[nextWord].split(' ') : [nextWord[0]];
                nextStartsWithVowel = VOWEL_INITIALS.has(nextPhonemes[0]);
            }
            if (w === 'the') {
                phonemes.push(...(nextStartsWithVowel ? ['ð','i'] : ['ð','ə']), '_');
            } else { // 'a'
                phonemes.push(...(nextStartsWithVowel ? ['e','ɪ'] : ['ə']), '_');
            }
            return;
        }
        
        if (ENG_DICT[w]) {
            phonemes.push(...ENG_DICT[w].split(' '), '_');
            return;
        }
        
        // Fallback heuristic rules — apply in order, most specific first
        let p = w;
        // Clusters and digraphs (must come before single letter rules)
        p = p.replace(/tion/g, 'ʃ ə n')
             .replace(/sion/g, 'ʒ ə n')
             .replace(/ture/g, 't ʃ ə r')
             .replace(/ing/g, 'ɪ ŋ')
             .replace(/ght/g, 't')          // night, light, might → silent gh
             .replace(/kn/g, 'n')           // know, knife → silent k
             .replace(/wr/g, 'r')           // write, wrong → silent w
             .replace(/mb$/g, 'm')          // lamb, comb → silent b
             .replace(/ed$/g, 'd')
             .replace(/ck/g, 'k')           // back, block
             .replace(/qu/g, 'k w')
             .replace(/th/g, 'θ')
             .replace(/ch/g, 't ʃ')
             .replace(/sh/g, 'ʃ')
             .replace(/ph/g, 'f')
             .replace(/wh/g, 'w')
             .replace(/oo/g, 'u')
             .replace(/ee/g, 'i')
             .replace(/ea/g, 'i')
             .replace(/ai|ay/g, 'e ɪ')
             .replace(/oa/g, 'o')
             .replace(/oi|oy/g, 'ɔ ɪ')
             .replace(/ou|ow/g, 'a ʊ')
             .replace(/au|aw/g, 'ɔ')
             .replace(/ew/g, 'j u')
             .replace(/ie/g, 'i')
             .replace(/ue/g, 'u')
             .replace(/e$/g, '')            // silent e (after digraphs removed)
             .replace(/c(?=[eiy])/g, 's')
             .replace(/c/g, 'k')
             .replace(/g(?=[eiy])/g, 'd ʒ') // gem, gist
             .replace(/x/g, 'k s')
             .replace(/a/g, 'æ')
             .replace(/e/g, 'ɛ')
             .replace(/i/g, 'ɪ')
             .replace(/o/g, 'ɔ')
             .replace(/u/g, 'ʌ')
             .replace(/y/g, 'j');
        
        // Split and filter to valid phonemes only
        let tokens = p.split(' ');
        let mapped = [];
        tokens.forEach(tok => {
            if (tok === '') return;
            // Each token may be a single IPA char or a plain letter
            [...tok].forEach(c => { if (PHONEMES[c]) mapped.push(c); });
        });
        phonemes.push(...mapped, '_');
    });
    return phonemes;
},
Fix 4 — Improve English fallback: add g before e/i/y → /dʒ/ rule
The current fallback has c(?=[eiy])→s but no equivalent for g(?=[eiy])→d ʒ. This is already in Fix 3's heuristic block above as .replace(/g(?=[eiy])/g, 'd ʒ'). Make sure it appears after the ch, gh, ght rules and before the plain c→k rule, so "generate", "gem", "giant" go through correctly when not in the dictionary. This is included in Fix 3.
Fix 5 — "from" over-enunciation and word gap rhythm
The word _ silence gap at 110ms is perceptible as a heavy pause between short words, making connected speech sound choppy. Reduce _ from 110 to 85ms in the PHONEMES table:
'_': { f1: 0, f2: 0, f3: 0, type: 'silence', dur: 85, amp: 0 },
Also increase the comma pause slightly for more natural breath grouping:
',': { f1: 0, f2: 0, f3: 0, type: 'silence', dur: 200, amp: 0 },
Fix 6 — Add context notes to Help modal
Add one line to the Tips section of the help modal:
<p style="color:var(--text-muted);margin-bottom:0.5rem;">• "The" automatically pronounces as "thee" before vowels and "thuh" before consonants based on context.</p>
Output the complete corrected single HTML file.

---

#Example 6

## PROMPT:

---

You are adding two features to the Webster formant speech synthesizer. Apply changes exactly as described. Do not modify unrelated code. Output the complete corrected file.

---

**Feature 1: WAV Export**

Add an Export WAV button to the toolbar. In HTML, add after the Load File button:
```html
<button class="secondary" id="btn-export">Export WAV</button>
```

Add a `renderToWAV` method to the `FormantSynth` class. This method mirrors `playSequence` but uses an `OfflineAudioContext` to render the entire synthesis to a buffer, then encodes it as a WAV file and triggers a download:

```js
async renderToWAV(phonemeSeq, config, onProgress) {
    const sampleRate = 44100;
    
    // Calculate total duration first
    const rateMult = 1 / config.rate;
    let totalDur = 0.2; // 100ms lead-in + 150ms fade-out
    phonemeSeq.forEach(p => {
        const pData = PHONEMES[p] || PHONEMES['_'];
        totalDur += (pData.dur / 1000) * rateMult;
    });
    totalDur += 0.3; // tail

    const offlineCtx = new OfflineAudioContext(1, Math.ceil(totalDur * sampleRate), sampleRate);

    // Recreate the audio graph in the offline context
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0;
    const analyserDummy = offlineCtx.createGain(); // no analyser needed offline
    masterGain.connect(offlineCtx.destination);

    const voicedSource = offlineCtx.createOscillator();
    voicedSource.type = 'sawtooth';
    voicedSource.start(0);

    const bufferSize = sampleRate * 2;
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.start(0);

    const f1 = offlineCtx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    const f2 = offlineCtx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
    const f3 = offlineCtx.createBiquadFilter(); f3.type = 'bandpass'; f3.Q.value = 10;
    const noiseFilter = offlineCtx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.Q.value = 2.5;
    const voicedGain = offlineCtx.createGain(); voicedGain.gain.value = 0;
    const noiseGain = offlineCtx.createGain(); noiseGain.gain.value = 0;

    voicedSource.connect(voicedGain);
    voicedGain.connect(f1); voicedGain.connect(f2); voicedGain.connect(f3);
    f1.connect(masterGain); f2.connect(masterGain); f3.connect(masterGain);
    noiseSource.connect(noiseGain);
    noiseGain.connect(noiseFilter);
    noiseFilter.connect(masterGain);

    // Run the same scheduling logic as playSequence
    const basePitch = config.pitch;
    const formantShift = config.formantScale;
    const brightness = config.brightness;
    const roughness = config.roughness;
    const pitchContour = this._buildPitchContour(phonemeSeq, config);

    const startTime = 0.1;
    let time = startTime;

    masterGain.gain.cancelScheduledValues(startTime);
    masterGain.gain.setValueAtTime(0, startTime);
    masterGain.gain.linearRampToValueAtTime(1.5, startTime + 0.05);
    masterGain.gain.setValueAtTime(1.5, startTime + 0.06);

    let prevF1 = (PHONEMES[phonemeSeq[0]]?.f1 || 500) * formantShift;
    let prevF2 = (PHONEMES[phonemeSeq[0]]?.f2 || 1500) * formantShift;
    let prevF3 = (PHONEMES[phonemeSeq[0]]?.f3 || 2500) * formantShift;
    let prevVGain = 0;

    phonemeSeq.forEach((p, i) => {
        f1.frequency.setValueAtTime(prevF1, time);
        f2.frequency.setValueAtTime(prevF2, time);
        f3.frequency.setValueAtTime(prevF3, time);
        voicedGain.gain.setValueAtTime(prevVGain, time);

        const pData = PHONEMES[p] || PHONEMES['_'];
        const dur = (pData.dur / 1000) * rateMult;
        const pPitch = pitchContour[i];

        let tF1 = (pData.f1 || 0) * formantShift;
        let tF2 = (pData.f2 || 0) * formantShift;
        let tF3 = (pData.f3 || 0) * formantShift;
        let tVGain = pData.type.includes('vowel') || pData.type.includes('approximant') || pData.type.includes('nasal') || pData.type === 'fricative_voiced' ? pData.amp : 0;
        let tNGain = pData.type.includes('fricative') ? pData.amp : 0;
        const tNFreq = (pData.noiseFreq || 1000) * brightness;
        if (tVGain > 0) { tVGain *= (1 - roughness * 0.4); tNGain += roughness * 0.2; }
        const transitionTime = dur * 0.25;
        const neutralF1 = 500 * formantShift, neutralF2 = 1500 * formantShift, neutralF3 = 2500 * formantShift;

        if (tF1 > 0) {
            f1.frequency.linearRampToValueAtTime(tF1, time + transitionTime);
            f2.frequency.linearRampToValueAtTime(tF2, time + transitionTime);
            f3.frequency.linearRampToValueAtTime(tF3, time + transitionTime);
        } else if (pData.type === 'silence' || pData.type.includes('plosive')) {
            f1.frequency.linearRampToValueAtTime(neutralF1, time + transitionTime);
            f2.frequency.linearRampToValueAtTime(neutralF2, time + transitionTime);
            f3.frequency.linearRampToValueAtTime(neutralF3, time + transitionTime);
        }
        voicedSource.frequency.linearRampToValueAtTime(pPitch, time + transitionTime);
        voicedGain.gain.linearRampToValueAtTime(tVGain, time + transitionTime * 0.5);
        if (pData.type.includes('fricative')) {
            noiseFilter.frequency.setValueAtTime(tNFreq, time);
            noiseGain.gain.linearRampToValueAtTime(tNGain, time + transitionTime);
            noiseGain.gain.setValueAtTime(tNGain, time + dur * 0.85);
            noiseGain.gain.linearRampToValueAtTime(0, time + dur * 0.98);
        } else {
            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(0, time + transitionTime * 0.5);
        }
        if (pData.type.includes('plosive')) {
            voicedGain.gain.setValueAtTime(pData.type === 'plosive_voiced' ? 0.2 : 0, time);
            noiseGain.gain.setValueAtTime(0, time);
            const burstTime = time + dur - 0.02;
            noiseFilter.frequency.setValueAtTime(pData.burstFreq * brightness, burstTime);
            noiseGain.gain.setValueAtTime(pData.amp, burstTime);
            noiseGain.gain.linearRampToValueAtTime(0, burstTime + 0.02);
        }
        prevF1 = tF1 > 0 ? tF1 : prevF1;
        prevF2 = tF2 > 0 ? tF2 : prevF2;
        prevF3 = tF3 > 0 ? tF3 : prevF3;
        prevVGain = tVGain;
        time += dur;
    });

    masterGain.gain.setValueAtTime(1.5, time - 0.001);
    masterGain.gain.linearRampToValueAtTime(0, time + 0.15);

    const renderedBuffer = await offlineCtx.startRendering();
    return this._encodeWAV(renderedBuffer);
}

_buildPitchContour(phonemeSeq, config) {
    // Extracted from playSequence so both real-time and offline rendering use identical prosody
    const basePitch = config.pitch;
    const sentenceLength = phonemeSeq.length;
    return phonemeSeq.map((p, i) => {
        // Use the prosody system — delegate to whatever _computePitch does
        return config._pitchContour ? config._pitchContour[i] : basePitch;
    });
}

_encodeWAV(buffer) {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.getChannelData(0);
    const numSamples = samples.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * bytesPerSample;
    const headerSize = 44;

    const ab = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(ab);

    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert float32 samples to int16
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return ab;
}
```

In `app.init()`, add the export button handler:
```js
document.getElementById('btn-export').addEventListener('click', () => this.exportWAV());
```

Add `exportWAV` method to `app`:
```js
async exportWAV() {
    const textarea = document.getElementById('text-input');
    const text = textarea.value;
    if (!text.trim()) return;

    document.getElementById('status-msg').innerText = 'Rendering WAV...';
    document.getElementById('btn-export').disabled = true;

    const phonemes = this.processText(text);
    const config = {
        pitch: parseInt(document.getElementById('pitch-slider').value),
        rate: parseFloat(document.getElementById('rate-slider').value),
        formantScale: parseFloat(document.getElementById('formant-slider').value),
        brightness: parseFloat(document.getElementById('brightness-slider').value),
        roughness: parseFloat(document.getElementById('roughness-slider').value),
    };

    // Attach precomputed pitch contour to config so renderToWAV uses identical prosody
    config._pitchContour = this.synth._computeProsodyContour(phonemes, config);

    try {
        const wavBuffer = await this.synth.renderToWAV(phonemes, config);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'webster_output.wav';
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('status-msg').innerText = 'WAV exported.';
    } catch(e) {
        document.getElementById('status-msg').innerText = 'Export failed.';
        console.error(e);
    }
    document.getElementById('btn-export').disabled = false;
},
```

---

**Feature 2: Improved Prosody**

Replace the current inline pitch contour calculation in `playSequence` with a proper prosody system. First add a `_computeProsodyContour` method to `FormantSynth`:

```js
_computeProsodyContour(phonemeSeq, config) {
    const basePitch = config.pitch;
    const n = phonemeSeq.length;

    // Detect sentence type from phoneme sequence (period vs question mark at end)
    // We pass sentence metadata via config
    const isQuestion = config.isQuestion || false;
    const isExclamation = config.isExclamation || false;

    // Find word boundaries (silence tokens mark word gaps)
    // Build per-phoneme stress weights: content positions get higher weight
    let stressWeights = new Array(n).fill(1.0);
    
    // Find stressed syllables: vowel phonemes that follow a consonant cluster
    // Simple heuristic: vowels in longer word-groups get stress boost
    let inWord = false;
    let wordVowelIndices = [];
    let wordStart = 0;
    
    for (let i = 0; i <= n; i++) {
        const p = phonemeSeq[i];
        const isBoundary = !p || p === '_' || p === ',' || p === '.';
        
        if (!isBoundary) {
            if (!inWord) { inWord = true; wordStart = i; wordVowelIndices = []; }
            const pData = PHONEMES[p];
            if (pData && (pData.type === 'vowel' || pData.type === 'nasal_vowel')) {
                wordVowelIndices.push(i);
            }
        } else if (inWord) {
            inWord = false;
            // Assign stress to first vowel of each word (simple primary stress rule)
            if (wordVowelIndices.length > 0) {
                // Primary stress on first vowel for most English words
                // But penultimate for longer words (rough approximation)
                const stressIdx = wordVowelIndices.length >= 3 
                    ? wordVowelIndices[wordVowelIndices.length - 2]  // penultimate
                    : wordVowelIndices[0]; // first
                stressWeights[stressIdx] = 1.35; // stressed vowel gets pitch boost
            }
        }
    }

    // Build contour
    const contour = new Array(n);
    
    for (let i = 0; i < n; i++) {
        const progress = i / Math.max(n - 1, 1);
        let pitch = basePitch;

        if (isQuestion) {
            // Questions: relatively flat through body, then RISE in final 25%
            if (progress < 0.75) {
                pitch = basePitch + Math.sin(progress * Math.PI * 0.5) * 8;
            } else {
                // Rise from basePitch to basePitch + 25Hz in final quarter
                const riseProgress = (progress - 0.75) / 0.25;
                pitch = basePitch + 8 + riseProgress * 25;
            }
        } else if (isExclamation) {
            // Exclamation: starts HIGH, falls fast
            pitch = basePitch + 20 * (1 - progress) + Math.sin(progress * Math.PI) * 10;
        } else {
            // Statement: slight rise in first third, plateau, fall in final 20%
            if (progress < 0.33) {
                pitch = basePitch + progress * 3 * 12; // rise to +12Hz
            } else if (progress < 0.80) {
                pitch = basePitch + 12; // plateau
            } else {
                // Fall: from +12Hz back to basePitch - 15Hz
                const fallProgress = (progress - 0.80) / 0.20;
                pitch = basePitch + 12 - fallProgress * 27;
            }
        }

        // Apply per-phoneme stress weight
        pitch *= stressWeights[i];

        // Clamp to reasonable range
        contour[i] = Math.max(60, Math.min(400, pitch));
    }

    return contour;
}
```

In `playSequence`, replace the existing pitch contour block:
```js
// OLD — remove this:
let pitchContour = [];
let sentenceLength = phonemeSeq.length;
phonemeSeq.forEach((p, i) => {
    let progress = i / sentenceLength;
    let pitchVar = Math.sin(progress * Math.PI) * 15;
    if (i > sentenceLength - 5) pitchVar -= 20;
    pitchContour.push(basePitch + pitchVar);
});

// NEW — replace with:
const pitchContour = config._pitchContour || this._computeProsodyContour(phonemeSeq, config);
```

In `app.processText`, detect sentence type and attach to config. Update the `play` method's config object:
```js
const config = {
    pitch: parseInt(document.getElementById('pitch-slider').value),
    rate: parseFloat(document.getElementById('rate-slider').value),
    formantScale: parseFloat(document.getElementById('formant-slider').value),
    brightness: parseFloat(document.getElementById('brightness-slider').value),
    roughness: parseFloat(document.getElementById('roughness-slider').value),
    isQuestion: text.trimEnd().endsWith('?'),
    isExclamation: text.trimEnd().endsWith('!'),
};
config._pitchContour = this.synth._computeProsodyContour(phonemes, config);
```

Do the same in `exportWAV` — the config construction there should also include `isQuestion` and `isExclamation` detection from the textarea text, and compute `_pitchContour` before calling `renderToWAV`.

Also update `_buildPitchContour` in `renderToWAV` to simply return `config._pitchContour` if present:
```js
_buildPitchContour(phonemeSeq, config) {
    return config._pitchContour || this._computeProsodyContour(phonemeSeq, config);
}
```

---

**Update Help modal** — add to Tips section:
```html
<p style="color:var(--text-muted);margin-bottom:0.5rem;">• Export WAV downloads the synthesized audio as a standard .wav file for use anywhere.</p>
<p style="color:var(--text-muted);margin-bottom:0.5rem;">• Questions get rising intonation, exclamations get a falling-then-level contour, statements get a natural fall at the end.</p>
```

---

Output the complete corrected single HTML file.

---

#Example 7

 
## PROMPT:

---

You are adding four features to Webster. Make targeted changes only. Output the complete corrected file.

---

**Feature 1: Pause / Resume**

Add a Pause button to the toolbar between Play/Stop and Read Selection. In HTML:
```html
<button class="secondary hidden" id="btn-pause">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause
</button>
<button class="secondary hidden" id="btn-resume">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume
</button>
```

Add to `FormantSynth`:
```js
pause() {
    if (this.ctx.state === 'running') this.ctx.suspend();
    this.isPaused = true;
}
resumePlayback() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPaused = false;
}
```

In `app.init()`:
```js
document.getElementById('btn-pause').addEventListener('click', () => this.pause());
document.getElementById('btn-resume').addEventListener('click', () => this.resumePlay());
```

Add to `app`:
```js
pause() {
    if (this.synth) this.synth.pause();
    document.getElementById('btn-pause').classList.add('hidden');
    document.getElementById('btn-resume').classList.remove('hidden');
    document.getElementById('status-msg').innerText = 'Paused';
},
resumePlay() {
    if (this.synth) this.synth.resumePlayback();
    document.getElementById('btn-pause').classList.remove('hidden');
    document.getElementById('btn-resume').classList.add('hidden');
    document.getElementById('status-msg').innerText = 'Playing...';
},
```

Show btn-pause when playing (alongside btn-stop). In `app.play()`, after showing btn-stop:
```js
document.getElementById('btn-pause').classList.remove('hidden');
```

In `app.stop()`:
```js
document.getElementById('btn-pause').classList.add('hidden');
document.getElementById('btn-resume').classList.add('hidden');
```

---

**Feature 2: Symbol and Punctuation Name Pronunciation**

Add a `SymbolExpander` object before `NumberExpander`. This runs as a pre-processing step that converts symbols to their spoken names in the active language. Implement it as:

```js
const SymbolExpander = {
    symbols: {
        '@':  { en:'at sign', de:'At-Zeichen', es:'arroba', fr:'arobase', it:'chiocciola', ru:'собачка', el:'παπάκι', ja:'アットマーク', ko:'골뱅이' },
        '#':  { en:'hash', de:'Raute', es:'almohadilla', fr:'dièse', it:'cancelletto', ru:'хэштег', el:'δίεση', ja:'シャープ', ko:'샵' },
        '$':  { en:'dollar', de:'Dollar', es:'dólar', fr:'dollar', it:'dollaro', ru:'доллар', el:'δολάριο', ja:'ドル', ko:'달러' },
        '€':  { en:'euro', de:'Euro', es:'euro', fr:'euro', it:'euro', ru:'евро', el:'ευρώ', ja:'ユーロ', ko:'유로' },
        '£':  { en:'pound', de:'Pfund', es:'libra', fr:'livre sterling', it:'sterlina', ru:'фунт', el:'λίρα', ja:'ポンド', ko:'파운드' },
        '%':  { en:'percent', de:'Prozent', es:'por ciento', fr:'pour cent', it:'percento', ru:'процент', el:'τοις εκατό', ja:'パーセント', ko:'퍼센트' },
        '&':  { en:'and', de:'und', es:'y', fr:'et', it:'e', ru:'и', el:'και', ja:'アンド', ko:'앤드' },
        '*':  { en:'asterisk', de:'Sternchen', es:'asterisco', fr:'astérisque', it:'asterisco', ru:'звёздочка', el:'αστερίσκος', ja:'アスタリスク', ko:'별표' },
        '/':  { en:'slash', de:'Schrägstrich', es:'barra', fr:'barre oblique', it:'barra', ru:'слеш', el:'κάθετος', ja:'スラッシュ', ko:'슬래시' },
        '\\': { en:'backslash', de:'Backslash', es:'barra invertida', fr:'barre oblique inverse', it:'barra rovescia', ru:'обратный слеш', el:'ανάστροφος', ja:'バックスラッシュ', ko:'역슬래시' },
        '+':  { en:'plus', de:'plus', es:'más', fr:'plus', it:'più', ru:'плюс', el:'συν', ja:'プラス', ko:'플러스' },
        '=':  { en:'equals', de:'gleich', es:'igual', fr:'égal', it:'uguale', ru:'равно', el:'ίσον', ja:'イコール', ko:'같다' },
        '<':  { en:'less than', de:'kleiner als', es:'menor que', fr:'inférieur à', it:'minore di', ru:'меньше', el:'μικρότερο από', ja:'より小さい', ko:'보다 작은' },
        '>':  { en:'greater than', de:'größer als', es:'mayor que', fr:'supérieur à', it:'maggiore di', ru:'больше', el:'μεγαλύτερο από', ja:'より大きい', ko:'보다 큰' },
        '^':  { en:'caret', de:'Dach', es:'circunflejo', fr:'accent circonflexe', it:'accento circonflesso', ru:'каретка', el:'περισπωμένη', ja:'キャレット', ko:'캐럿' },
        '~':  { en:'tilde', de:'Tilde', es:'tilde', fr:'tilde', it:'tilde', ru:'тильда', el:'περισπωμένη', ja:'チルダ', ko:'물결표' },
        '|':  { en:'pipe', de:'Pipe', es:'barra vertical', fr:'barre verticale', it:'barra verticale', ru:'вертикальная черта', el:'κατακόρυφη γραμμή', ja:'パイプ', ko:'파이프' },
        '_':  { en:'underscore', de:'Unterstrich', es:'guión bajo', fr:'tiret bas', it:'trattino basso', ru:'нижнее подчёркивание', el:'κάτω παύλα', ja:'アンダースコア', ko:'밑줄' },
        '…':  { en:'ellipsis', de:'Auslassungspunkte', es:'puntos suspensivos', fr:'points de suspension', it:'puntini di sospensione', ru:'многоточие', el:'αποσιωπητικά', ja:'省略記号', ko:'줄임표' },
        '—':  { en:'dash', de:'Gedankenstrich', es:'raya', fr:'tiret', it:'lineetta', ru:'тире', el:'παύλα', ja:'ダッシュ', ko:'대시' },
        '"':  { en:'quote', de:'Anführungszeichen', es:'comillas', fr:'guillemets', it:'virgolette', ru:'кавычки', el:'εισαγωγικά', ja:'引用符', ko:'따옴표' },
        "'":  { en:'apostrophe', de:'Apostroph', es:'apóstrofo', fr:'apostrophe', it:'apostrofo', ru:'апостроф', el:'απόστροφος', ja:'アポストロフィ', ko:'어포스트로피' },
        '(':  { en:'open parenthesis', de:'öffnende Klammer', es:'paréntesis abierto', fr:'parenthèse ouvrante', it:'parentesi aperta', ru:'открывающая скобка', el:'ανοιχτή παρένθεση', ja:'開き括弧', ko:'여는 괄호' },
        ')':  { en:'close parenthesis', de:'schließende Klammer', es:'paréntesis cerrado', fr:'parenthèse fermante', it:'parentesi chiusa', ru:'закрывающая скобка', el:'κλειστή παρένθεση', ja:'閉じ括弧', ko:'닫는 괄호' },
        '[':  { en:'open bracket', de:'öffnende eckige Klammer', es:'corchete abierto', fr:'crochet ouvrant', it:'parentesi quadra aperta', ru:'открывающая квадратная скобка', el:'άγκιστρο', ja:'開き角括弧', ko:'열린 대괄호' },
        ']':  { en:'close bracket', de:'schließende eckige Klammer', es:'corchete cerrado', fr:'crochet fermant', it:'parentesi quadra chiusa', ru:'закрывающая квадратная скобка', el:'κλείσιμο αγκίστρου', ja:'閉じ角括弧', ko:'닫힌 대괄호' },
    },

    // Mode: 'pause' = treat as pause cues (default reading mode)
    //       'speak' = speak symbol names aloud
    expand(text, lang, mode = 'pause') {
        if (mode === 'pause') {
            // Convert non-puctuation symbols to brief pauses or skip
            return text
                .replace(/\.\.\./g, ',')   // ellipsis → comma pause
                .replace(/—/g, ',')         // em dash → comma pause
                .replace(/[_|^~\\[\](){}'"<>=+*&%$€£#@]/g, ' '); // strip other symbols
        } else {
            // Speak names of symbols
            return text.replace(/[.]{3}|[—@#$€£%&*/\\+\-=<>^~|_()\[\]'"]/g, (sym) => {
                const entry = this.symbols[sym === '...' ? '…' : sym];
                if (!entry) return ' ';
                return ' ' + (entry[lang] || entry.en) + ' ';
            });
        }
    }
};
```

Add a **Symbol Mode** toggle button to the toolbar, after Load File:
```html
<button class="secondary" id="btn-symbol-mode" title="Toggle: symbols as pauses or spoken names">Sym: Pause</button>
```

In `app`, add `symbolMode: 'pause'` property. In `init()`:
```js
this.symbolMode = 'pause';
document.getElementById('btn-symbol-mode').addEventListener('click', () => {
    this.symbolMode = this.symbolMode === 'pause' ? 'speak' : 'pause';
    document.getElementById('btn-symbol-mode').innerText = 'Sym: ' + (this.symbolMode === 'pause' ? 'Pause' : 'Speak');
});
```

In `processText()`, add symbol expansion as the FIRST step, before number expansion:
```js
text = SymbolExpander.expand(text, lang, this.symbolMode);
text = NumberExpander.expand(text, lang);
```

---

**Feature 3: Natural Voice Mode**

Add a `naturalMode` boolean to `app` (default `false`). Add a toggle button to the voice controls section in the right panel, above the voice preset:
```html
<div class="control-group">
    <label>Voice Mode</label>
    <div style="display:flex;gap:10px;">
        <button class="toggle-btn active" id="btn-classic" style="flex:1;">Classic</button>
        <button class="toggle-btn" id="btn-natural" style="flex:1;">Natural</button>
    </div>
</div>
```

In `app.init()`:
```js
this.naturalMode = false;
document.getElementById('btn-classic').addEventListener('click', () => {
    this.naturalMode = false;
    document.getElementById('btn-classic').classList.add('active');
    document.getElementById('btn-natural').classList.remove('active');
});
document.getElementById('btn-natural').addEventListener('click', () => {
    this.naturalMode = true;
    document.getElementById('btn-natural').classList.add('active');
    document.getElementById('btn-classic').classList.remove('active');
});
```

Pass `naturalMode` in config from `app.play()` and `exportWAV()`:
```js
natural: this.naturalMode,
```

In `FormantSynth.playSequence()`, after computing `pitchContour`, add natural mode processing. Add this block immediately before the `phonemeSeq.forEach` loop:

```js
// Natural mode: add micro-jitter to pitch contour and prepare shimmer
const natural = config.natural || false;
if (natural) {
    // Add per-phoneme micro-pitch jitter (±3Hz random walk)
    let jitter = 0;
    for (let i = 0; i < pitchContour.length; i++) {
        jitter = jitter * 0.7 + (Math.random() - 0.5) * 4; // low-pass random
        pitchContour[i] = Math.max(60, Math.min(400, pitchContour[i] + jitter));
    }
    // Switch voiced source to a softer waveform
    this.voicedSource.type = 'sawtooth'; // keep sawtooth but we'll mix aspiration
}
```

In the `FormantSynth` constructor, add an aspiration noise path for natural mode:
```js
// Aspiration (natural mode): low-level noise mixed into voiced path
this.aspirationNoise = this.ctx.createBufferSource();
const aspBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
const aspData = aspBuf.getChannelData(0);
for (let i = 0; i < aspData.length; i++) aspData[i] = Math.random() * 2 - 1;
this.aspirationNoise.buffer = aspBuf;
this.aspirationNoise.loop = true;
this.aspirationNoise.start();
this.aspirationGain = this.ctx.createGain();
this.aspirationGain.gain.value = 0;
const aspFilter = this.ctx.createBiquadFilter();
aspFilter.type = 'bandpass';
aspFilter.frequency.value = 2000;
aspFilter.Q.value = 0.5;
this.aspirationNoise.connect(aspFilter);
aspFilter.connect(this.aspirationGain);
this.aspirationGain.connect(this.masterGain);
```

In the phoneme scheduling loop, after computing `tVGain`, add:
```js
// Natural mode: mix aspiration into vowels, apply shimmer
if (natural && (pData.type === 'vowel' || pData.type === 'nasal_vowel')) {
    const aspLevel = 0.04 + roughness * 0.02;
    this.aspirationGain.gain.setValueAtTime(0, time);
    this.aspirationGain.gain.linearRampToValueAtTime(aspLevel, time + transitionTime);
    this.aspirationGain.gain.setValueAtTime(aspLevel, time + dur - transitionTime);
    this.aspirationGain.gain.linearRampToValueAtTime(0, time + dur);
    // Shimmer: slight amplitude wobble — lower the Q on formants slightly for broader resonance
    // (achieved by reducing tVGain slightly randomly)
    tVGain *= (0.92 + Math.random() * 0.16);
} else if (natural) {
    this.aspirationGain.gain.setValueAtTime(0, time);
}
```

Also in natural mode, reduce formant filter Q for warmer sound. After the constructor filter setup, the Q values are already set. In `playSequence`, at the start, after extracting config values, add:
```js
if (natural) {
    this.f1.Q.value = 3;
    this.f2.Q.value = 5;
    this.f3.Q.value = 7;
} else {
    this.f1.Q.value = 5;
    this.f2.Q.value = 8;
    this.f3.Q.value = 10;
}
```

Mirror the aspiration path in `renderToWAV` — add the same aspiration buffer source, filter, and gain to the offline context graph, and apply the same scheduling logic.

---

**Feature 4: window.webster API + postMessage listener**

Add this block at the end of the script, after `app.init()` is registered:

```js
// Webster Public API
// Usable as window.webster.speak() from the same page,
// or via postMessage from an iframe parent.
window.webster = {
    speak(text, options = {}) {
        const lang = options.lang || document.getElementById('lang-select').value;
        document.getElementById('lang-select').value = lang;
        if (options.pitch !== undefined) {
            document.getElementById('pitch-slider').value = options.pitch;
            document.getElementById('pitch-val').innerText = options.pitch;
        }
        if (options.rate !== undefined) {
            document.getElementById('rate-slider').value = options.rate;
            document.getElementById('rate-val').innerText = parseFloat(options.rate).toFixed(1) + 'x';
        }
        if (options.preset && VOICE_PRESETS[options.preset]) {
            document.getElementById('voice-preset').value = options.preset;
            document.getElementById('voice-preset').dispatchEvent(new Event('change'));
        }
        if (options.natural !== undefined) app.naturalMode = options.natural;
        document.getElementById('text-input').value = text;
        app.stop();
        app.play();
    },
    stop() { app.stop(); },
    pause() { app.pause(); },
    resume() { app.resumePlay(); },
    async export(text, options = {}) {
        if (text) document.getElementById('text-input').value = text;
        return app.exportWAV();
    },
    getPresets() { return Object.keys(VOICE_PRESETS); }
};

// postMessage API — embed Webster in an iframe and send messages to it
window.addEventListener('message', (event) => {
    const d = event.data;
    if (!d || d.target !== 'webster') return;
    switch(d.action) {
        case 'speak': window.webster.speak(d.text, d.options || {}); break;
        case 'stop':  window.webster.stop(); break;
        case 'pause': window.webster.pause(); break;
        case 'resume': window.webster.resume(); break;
        case 'getPresets':
            event.source?.postMessage({ source:'webster', presets: window.webster.getPresets() }, '*');
            break;
    }
});
```

Add to the Help modal a new API section before the closing div:
```html
<h3 style="margin-bottom:0.5rem;">API Usage</h3>
<p style="color:var(--text-muted);margin-bottom:0.5rem;">Webster exposes a JavaScript API. From the same page: <code style="background:var(--bg-input);padding:2px 6px;border-radius:4px;">window.webster.speak("Hello world", {preset:"hal", rate:0.8})</code></p>
<p style="color:var(--text-muted);margin-bottom:0.5rem;">From an iframe parent: send <code style="background:var(--bg-input);padding:2px 6px;border-radius:4px;">postMessage({target:"webster", action:"speak", text:"Hello", options:{lang:"ja"}}, "*")</code></p>
<p style="color:var(--text-muted);">Options: <code style="background:var(--bg-input);padding:2px 6px;border-radius:4px;">lang, pitch, rate, preset, natural</code>. Actions: speak, stop, pause, resume, getPresets.</p>
```

---

**Feature 5: English morphological rules for -ed and -s**

In `G2P.english`, the fallback currently maps all `-ed` endings to `/d/`. Replace the single `.replace(/ed$/, 'd')` rule with a contextual function applied before fallback regex. Add this helper function before the `G2P` object:

```js
function engInflectionPhonemes(word) {
    // -ed endings: /t/ after voiceless, /ɪd/ after t/d, /d/ after voiced
    if (word.endsWith('ed') && word.length > 3) {
        const stem = word.slice(0, -2);
        const lastChar = stem[stem.length - 1];
        if ('td'.includes(lastChar)) return stem + ' ɪ d';
        if ('pksf θʃ'.includes(lastChar) || stem.endsWith('ch') || stem.endsWith('sh')) return stem + ' t';
        return stem + ' d';
    }
    // -s/-es endings: /ɪz/ after sibilants, /s/ after voiceless, /z/ after voiced
    if ((word.endsWith('s') || word.endsWith('es')) && word.length > 2) {
        const stem = word.endsWith('es') ? word.slice(0,-2) : word.slice(0,-1);
        const lastChar = stem[stem.length-1];
        if ('szʃʒ'.includes(lastChar) || stem.endsWith('ch') || stem.endsWith('sh') || stem.endsWith('x')) {
            return stem + ' ɪ z';
        }
        if ('ptkf θ'.includes(lastChar)) return stem + ' s';
        return stem + ' z';
    }
    return null;
}
```

In `G2P.english`, in the fallback section, before the regex chain, check `engInflectionPhonemes`:
```js
const inflected = engInflectionPhonemes(w);
if (inflected) {
    // Run the inflected form through G2P recursively (one level only)
    const subPhonemes = G2P.english(inflected);
    // Remove trailing '_' that would be added by recursive call
    while (subPhonemes.length && subPhonemes[subPhonemes.length-1] === '_') subPhonemes.pop();
    phonemes.push(...subPhonemes, '_');
    return;
}
// ... then the existing regex chain
```

---

Output the complete corrected single HTML file.

---

#Example 8

Well now the right fighter can't move at all, the left fighter can go all the way though. Couldn't the coordinate system and fighting field be bound to each fighter individually? Like, maybe we're approaching this wrong. Think about DOOM or Wolfenstein 3D, that raycasting, making it seem like it was one thing but was actually another? What if we only make it look like the fighters are on the same plane but just make multiple planes that are layered on top of one another? We could make a unique plane for each fighter that can start on either left or right depending on what each player picks, and if they pick the same character we do the classic fighter 1 fighter 1a with a pallet swap. Have the hit boxes unique to each fighter by structuring them to the layer-plane of each fighter so the fighters seem unique and the hits actually feel like they count?

---

#Example 9

You are rebuilding **Combat's Game of Doom** from scratch with a correct architecture. Previous versions had a fundamental flaw: both fighters shared one coordinate space, causing movement conflicts. This version fixes that permanently with independent fighter layers.

This is a **ConsciousNode SoftWorks** project. House aesthetic: zero external dependencies, offline-first, MIT licensed, philosophically coherent, named by a goblin. The tone is serious about the art and unhinged about everything else.

---

## THE CORE ARCHITECTURAL INSIGHT

Each fighter lives on their own independent full-screen layer. Both layers cover 100vw x 100vh and are stacked on top of each other. Each fighter moves freely within their own layer using identical zone coordinates. Visual overlap is how the fighters appear to be on the same plane — like a parallax illusion or raycasting trick. They are not actually sharing space. They just look like they are.

This means:
- Movement is completely independent per fighter
- No coordinate conflicts ever
- Hit detection checks zone INDEX adjacency only
- Adding a third fighter means adding a third layer

---

## LAYER ARCHITECTURE

```
#arena                          — position: relative, full screen
  #layer-p1                     — position: absolute, 100vw 100vh, z-index: 50, pointer-events: none
    #p1                         — fighter container, moves within this layer
  #layer-p2                     — position: absolute, 100vw 100vh, z-index: 49, pointer-events: none
    #p2                         — fighter container, moves within this layer
  .arena-bg-left                — left half background, z-index: 1
  .arena-bg-right               — right half background, z-index: 1
  .arena-floor                  — floor strip, z-index: 10
```

Zone positions are IDENTICAL for both layers:

```css
.fighter-container.zone-left   { left: 5vw; }
.fighter-container.zone-center { left: 37vw; }
.fighter-container.zone-right  { left: 68vw; }
```

Drive positions via :has() on the root checkbox states as before, targeting each fighter's container inside its own layer. Since both layers are full-screen, left: 37vw on #layer-p1 #p1 and left: 37vw on #layer-p2 #p2 both render at the same screen position. Overlap achieved. No conflicts.

---

## CHARACTER SELECT SCREEN

Before the fight, show a character select screen. Order of screens: Title → Character Select → Fight.

Character select layout: two side-by-side pick panels, one for each player. Each panel shows both fighter options with their name and a brief mechanical description.

Available fighters:
- PAZUZU (Assyrian wind demon — fast glass cannon)
- ONI (Japanese demon — slow tank)

Each player independently selects: which fighter AND which side (left start or right start).

If both players pick the same fighter, Player 2 gets a palette swap version automatically. Palette swap: apply hue-rotate(180deg) to the P2 layer's fighter art. Add a small indicator like PAZUZU II or ONI II.

Character select is driven by CSS checkbox state. Clicking a fighter card checks a hidden radio-style checkbox. Clicking a side button checks a side checkbox. A READY button per player confirms selection. When both players are ready, clicking FIGHT transitions to the arena.

Track these in CHECKBOX MEMORY:
- p1-picks-pazuzu, p1-picks-oni
- p2-picks-pazuzu, p2-picks-oni
- p1-side-left, p1-side-right
- p2-side-left, p2-side-right
- p1-ready, p2-ready

Starting zone is set by JS when FIGHT is clicked based on side selection checkboxes.

---

## CHECKBOX MEMORY

All game state lives in hidden checkboxes. Full list:

```html
<!-- Screen flow -->
<input type="checkbox" id="screen-select">     <!-- show character select -->
<input type="checkbox" id="screen-fight">      <!-- show arena -->
<input type="checkbox" id="help-open">

<!-- Character select -->
<input type="checkbox" id="p1-picks-pazuzu">
<input type="checkbox" id="p1-picks-oni">
<input type="checkbox" id="p2-picks-pazuzu">
<input type="checkbox" id="p2-picks-oni">
<input type="checkbox" id="p1-side-left">
<input type="checkbox" id="p1-side-right">
<input type="checkbox" id="p2-side-left">
<input type="checkbox" id="p2-side-right">
<input type="checkbox" id="p1-ready">
<input type="checkbox" id="p2-ready">

<!-- Zone states — P1 -->
<input type="checkbox" id="p1-zone-left" checked>
<input type="checkbox" id="p1-zone-center">
<input type="checkbox" id="p1-zone-right">

<!-- Zone states — P2 -->
<input type="checkbox" id="p2-zone-left">
<input type="checkbox" id="p2-zone-center">
<input type="checkbox" id="p2-zone-right" checked>

<!-- Hit signals -->
<input type="checkbox" id="p1-took-hit">
<input type="checkbox" id="p2-took-hit">
<input type="checkbox" id="p1-took-heavy">
<input type="checkbox" id="p2-took-heavy">

<!-- P1 health tiers -->
<input type="checkbox" id="p1-hp5" checked>
<input type="checkbox" id="p1-hp4">
<input type="checkbox" id="p1-hp3">
<input type="checkbox" id="p1-hp2">
<input type="checkbox" id="p1-hp1">
<input type="checkbox" id="p1-dead">

<!-- P2 health tiers -->
<input type="checkbox" id="p2-hp5" checked>
<input type="checkbox" id="p2-hp4">
<input type="checkbox" id="p2-hp3">
<input type="checkbox" id="p2-hp2">
<input type="checkbox" id="p2-hp1">
<input type="checkbox" id="p2-dead">

<!-- P1 inputs -->
<input type="checkbox" id="p1-left">
<input type="checkbox" id="p1-right">
<input type="checkbox" id="p1-jump">
<input type="checkbox" id="p1-block">
<input type="checkbox" id="p1-light">
<input type="checkbox" id="p1-heavy">

<!-- P2 inputs -->
<input type="checkbox" id="p2-left">
<input type="checkbox" id="p2-right">
<input type="checkbox" id="p2-jump">
<input type="checkbox" id="p2-block">
<input type="checkbox" id="p2-light">
<input type="checkbox" id="p2-heavy">
```

---

## MOVEMENT SYSTEM

Zone positions defined once, applied to both fighters via their own layers:

```css
:root:has(#p1-zone-left:checked) #layer-p1 #p1   { left: 5vw; }
:root:has(#p1-zone-center:checked) #layer-p1 #p1 { left: 37vw; }
:root:has(#p1-zone-right:checked) #layer-p1 #p1  { left: 68vw; }

:root:has(#p2-zone-left:checked) #layer-p2 #p2   { left: 5vw; }
:root:has(#p2-zone-center:checked) #layer-p2 #p2 { left: 37vw; }
:root:has(#p2-zone-right:checked) #layer-p2 #p2  { left: 68vw; }
```

Jump: translateY on the fighter container, independent per layer.

JS zone transition functions — one per fighter, identical logic:

```javascript
function moveP1(direction) {
    const zones = ['p1-zone-left', 'p1-zone-center', 'p1-zone-right'];
    const current = zones.findIndex(z => document.getElementById(z).checked);
    zones.forEach(z => document.getElementById(z).checked = false);
    if (direction === 'right') {
        document.getElementById(zones[Math.min(current + 1, 2)]).checked = true;
    } else {
        document.getElementById(zones[Math.max(current - 1, 0)]).checked = true;
    }
}
// moveP2 is identical, operating on p2-zone-* checkboxes
```

Movement cooldown: 150ms per player. Prevents zone-skip on held keys.

---

## HIT DETECTION

Since both layers are full-screen with identical zone coordinates, zone-left on layer-p1 and zone-left on layer-p2 are the same screen position. Hit detection is pure index comparison:

```javascript
const adjacent = (a, b) => {
    const zones = ['left', 'center', 'right'];
    const ai = zones.indexOf(a.replace('p1-zone-', '').replace('p2-zone-', ''));
    const bi = zones.indexOf(b.replace('p1-zone-', '').replace('p2-zone-', ''));
    return Math.abs(ai - bi) <= 1;
};
```

Call checkHits() on every keydown event after processing movement and attack inputs. Hit cooldown: 500ms per player. Prevents damage spam.

---

## HEALTH SYSTEM

Five tiers per fighter. Tier advances are permanent — driven by JS writing to health tier checkboxes. CSS reads health tier checkboxes to set health bar width with smooth transition.

```css
:root:has(#p1-hp5:checked) #p1-health-fill { width: 100%; }
:root:has(#p1-hp4:checked) #p1-health-fill { width: 80%; }
:root:has(#p1-hp3:checked) #p1-health-fill { width: 60%; }
:root:has(#p1-hp2:checked) #p1-health-fill { width: 40%; }
:root:has(#p1-hp1:checked) #p1-health-fill { width: 20%; }
:root:has(#p1-dead:checked) #p1-health-fill { width: 0%; }
```

Damage rules:
- Pazuzu vs Oni light: advances Oni health every 2 hits (Oni is tanky)
- Pazuzu vs Oni heavy: advances Oni health every hit
- Oni vs Pazuzu light: advances Pazuzu health every hit
- Oni vs Pazuzu heavy: advances Pazuzu health 2 tiers (glass cannon)
- Blocking: negates all damage from that hit

---

## WIN STATE

Driven by dead checkboxes, no animation required:

```css
:root:has(#p1-dead:checked) #ko-p2-wins { opacity: 1; pointer-events: all; }
:root:has(#p2-dead:checked) #ko-p1-wins { opacity: 1; pointer-events: all; }
```

KO screen shows: K.O. text, winner name, FIGHT AGAIN button that calls location.reload().

Hit flash overlay: white full-screen div, flashes on heavy hits via p1-took-heavy and p2-took-heavy checkbox CSS triggers, fades out via transition.

---

## FIGHTER ART

Carry over the existing fighter art exactly from the previous version. Do not redesign the fighters.

PAZUZU: angular teal/cyan body, two swept wings, diamond head with gold eye, extending arm with talon, wind trail effect on attacks.

ONI: massive rounded red body, white horns, gold-striped loincloth, arm with spotted club, breathe animation.

Both fighters are pure CSS — no images, no canvas, no SVG.

Palette swap for mirror matches: if both players pick the same fighter, P2's layer gets a hue-rotate(180deg) filter applied to the visuals div. Pazuzu becomes magenta. Oni becomes blue-green.

Fighter facing direction: P1 always faces right. P2 always faces left. Implement by applying scaleX(-1) to P2's fighter visuals div by default. This means regardless of which side they start on or where they move, they always face their opponent.

---

## JS KEYBOARD ADAPTER

JS does three things only: translates keyboard input to checkboxes, manages zone transitions, manages hit detection. It does not do anything else.

```javascript
const keys = {
    'a': 'p1-left', 'd': 'p1-right', 'w': 'p1-jump', 's': 'p1-block',
    'f': 'p1-light', 'g': 'p1-heavy',
    'ArrowLeft': 'p2-left', 'ArrowRight': 'p2-right',
    'ArrowUp': 'p2-jump', 'ArrowDown': 'p2-block',
    'l': 'p2-light', ';': 'p2-heavy'
};
```

Keydown: set checkbox checked, trigger zone move with cooldown, call checkHits.
Keyup: uncheck checkbox.

---

## HELP MODAL

Pure CSS modal driven by help-open checkbox. Label toggles it open and closed. No JS required.

Contents: controls for both players, about the fighters (lore), about this game (the unprecedented CSS engine claim), credits.

---

## CONFIG

All tunable values as CSS custom properties on :root:

```css
:root {
    --arena-floor-height: 100px;
    --fighter-speed: 0.2s;
    --jump-height: -220px;
    --health-bar-transition: 0.3s;
    --move-cooldown: 150;     /* ms, used in JS */
    --hit-cooldown: 500;      /* ms, used in JS */
    
    --pazuzu-primary: #00ffff;
    --pazuzu-secondary: #ffd700;
    --pazuzu-dark: #004d4d;
    --oni-primary: #ff3333;
    --oni-skin: #cc0000;
    --oni-horn: #f2f2f2;
    --cn-green: #00ff66;
    --bg-color: #050505;
}
```

---

## INTERNAL ARCHITECTURE

Section headers use the ConsciousNode style throughout:

```
/* ╔══════════════════════════╗
   ║     SECTION NAME         ║
   ╚══════════════════════════╝ */
```

Sections in order: CONFIG / CHECKBOX MEMORY / TITLE SCREEN / CHARACTER SELECT / ARENA / LAYER SYSTEM / MOVEMENT / HEALTH SYSTEM / FIGHTER ART PAZUZU / FIGHTER ART ONI / UI / HELP MODAL / WIN STATE / JS KEYBOARD ADAPTER / INIT

ADDING A NEW FIGHTER (document in a comment block):
1. Add fighter art section following PAZUZU/ONI templates
2. Add character select card
3. Add layer HTML following p1/p2 layer pattern
4. Add zone CSS for new layer
5. Add health tier checkboxes
6. Add input checkboxes
7. Add hit detection entries in checkHits()
Zero engine refactoring required.

---

## PRECEDENT COMMENT BLOCK

Include at the top of the script section:

```
Combat's Game of Doom — ConsciousNode SoftWorks

This is a fighting game where the game engine is CSS.
Not assisted by CSS. Not styled with CSS.
CSS IS the engine.

Architecture: independent fighter layers, raycasting-inspired
Hit detection: zone index adjacency
Health tracking: CSS tier checkboxes
State management: checkbox cascade
Game logic: selector specificity resolution
JS role: keyboard-to-checkbox adapter

This has not been done before.
We checked.
```

---

## HARD CONSTRAINTS

- Single HTML file
- Zero external dependencies
- MIT license header
- Works offline
- Desktop browser only
- JS is strictly the keyboard adapter plus zone/hit helpers
- No images, no canvas, no SVG — CSS art only

---

## DELIVERABLE

One complete working combats-game-of-doom.html featuring:
- Title screen
- Character select with fighter and side choice
- Independent layer movement system — both fighters traverse full screen freely
- Functional hit detection via zone adjacency
- Health tiers driven by CSS checkboxes
- KO and win state
- Pure CSS fighter art for both characters carried over from previous version
- Help modal
- The unprecedented claim intact and defensible

CSS is the engine. The demons are real. The goblin named it.

---

#Example 10

Whats everything available to a single file application? Like, css as a game engine sort of level of "that's NOT SUPPOSED TO DO THAT WHAT ARE YOU DOING" sort of dude. I coined a term while I was driving, Xinu. The inverse of Unix. A thing does one thing and does only one thing and does it well? OK cool now what else can we get it to do.