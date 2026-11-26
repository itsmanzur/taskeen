import { useRef, useState } from 'react';
import { TaskeenItem } from '../types';
import { Notify } from '../lib/constants';

export function useAudioPlayer(selectedItem: TaskeenItem | undefined, notify: Notify) {
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [audioMode, setAudioMode] = useState<'idle' | 'pack' | 'tts'>('idle');
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<number | null>(null);

  const stopAudio = () => {
    setAudioPlaying(false);
    setAudioProgress(0);
    setAudioMode('idle');
    if (audioTimerRef.current) window.clearInterval(audioTimerRef.current);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
  };

  const playTtsFallback = () => {
    setAudioMode('tts');
    let pct = 0;
    audioTimerRef.current = window.setInterval(() => {
      pct += 4 * audioSpeed;
      if (pct >= 100) {
        stopAudio();
        notify('তিলাওয়াত সম্পন্ন হয়েছে');
      } else {
        setAudioProgress(Math.min(100, pct));
      }
    }, 250);
    try {
      if (window.speechSynthesis && selectedItem) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(selectedItem.arabic_uthmani);
        utter.lang = 'ar-SA';
        utter.rate = audioSpeed;
        utter.onend = () => stopAudio();
        window.speechSynthesis.speak(utter);
      }
    } catch {}
  };

  const toggleAudio = () => {
    if (audioPlaying) {
      stopAudio();
      return;
    }
    if (!selectedItem) return;
    setAudioPlaying(true);

    const tryAudioFile = (ext: 'opus' | 'mp3') => {
      const audio = new Audio(`/audio/${selectedItem.id}.${ext}`);
      audio.playbackRate = audioSpeed;
      audioElRef.current = audio;
      audio.oncanplaythrough = () => {
        setAudioMode('pack');
      };
      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setAudioProgress(Math.min(100, (audio.currentTime / audio.duration) * 100));
        }
      };
      audio.onended = () => {
        stopAudio();
        notify('তিলাওয়াত সম্পন্ন হয়েছে');
      };
      audio.onerror = () => {
        if (ext === 'opus') {
          tryAudioFile('mp3');
        } else {
          playTtsFallback();
        }
      };
      audio.play().catch(() => {
        if (ext === 'opus') tryAudioFile('mp3');
        else playTtsFallback();
      });
    };

    tryAudioFile('opus');
  };

  return {
    playing: audioPlaying,
    progress: audioProgress,
    speed: audioSpeed,
    setSpeed: setAudioSpeed,
    mode: audioMode,
    toggle: toggleAudio,
    stop: stopAudio,
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
