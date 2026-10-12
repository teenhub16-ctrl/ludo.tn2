const BASE = import.meta.env.BASE_URL;

const soundPaths = {
  gameStart: `${BASE}sounds/game-start.mp3`,
  diceRoll: `${BASE}sounds/dice-roll.mp3`,
  tokenMove: `${BASE}sounds/token-move.mp3`,
  tokenExit: `${BASE}sounds/token-exit.mp3`,
  safeSpot: `${BASE}sounds/safe-spot.mp3`,
  capture: `${BASE}sounds/capture.mp3`,
  retreat: `${BASE}sounds/retreat.mp3`,
  homeEntry: `${BASE}sounds/home-entry.mp3`,
  victory: `${BASE}sounds/victory.mp3`,
} as const;

export type TSoundName = keyof typeof soundPaths;

const sounds: Partial<Record<TSoundName, HTMLAudioElement>> = {};

export function playSound(name: TSoundName): void {
  if (typeof window === 'undefined') return;
  if (typeof Audio === 'undefined') return;

  let audio = sounds[name];
  if (!audio) {
    audio = new Audio(soundPaths[name]);
    sounds[name] = audio;
  }
  audio.volume = 1;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // المتصفح يمنع التشغيل قبل تفاعل المستخدم. نتجاهل الخطأ.
  });
}

export function unlockAllSounds(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (typeof Audio === 'undefined') return Promise.resolve();

  const promises: Promise<void>[] = [];

  (Object.keys(soundPaths) as TSoundName[]).forEach((name) => {
    if (!sounds[name]) {
      sounds[name] = new Audio(soundPaths[name]);
    }
    const audio = sounds[name]!;
    audio.volume = 0;
    const p = audio.play();
    if (p !== undefined) {
      promises.push(
        p
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
          })
          .catch(() => {
            audio.volume = 1;
          })
      );
    } else {
      audio.volume = 1;
    }
  });

  return Promise.all(promises).then(() => undefined);
}