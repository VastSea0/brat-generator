'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DownloadIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  UploadIcon,
  FileTextIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ColorPreset, colorPresets } from '@/lib/types';
import {
  parseLrc,
  getActiveLine,
  getLrcDuration,
  formatTime,
  sampleLrc,
  type ParsedLrc,
} from '@/lib/lrc-parser';
import { toPng } from 'html-to-image';

interface BratLrcPlayerProps {
  selectedPreset: ColorPreset;
  setSelectedPreset: (preset: ColorPreset) => void;
}

function BratLrcPlayer({
  selectedPreset,
  setSelectedPreset,
}: BratLrcPlayerProps) {
  const bratBoxRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const activeLineRef = useRef<number>(-1);
  const parsedLrcRef = useRef<ParsedLrc | null>(null);

  const [lrcContent, setLrcContent] = useState(sampleLrc);
  const [parsedLrc, setParsedLrc] = useState<ParsedLrc | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [showInput, setShowInput] = useState(false);
  const [displayText, setDisplayText] = useState('');

  // Parse LRC content whenever it changes
  useEffect(() => {
    if (lrcContent.trim()) {
      const parsed = parseLrc(lrcContent);
      setParsedLrc(parsed);
      parsedLrcRef.current = parsed;
      setCurrentTime(0);
      setActiveLineIndex(-1);
      activeLineRef.current = -1;
      setIsPlaying(false);
      setDisplayText(parsed.metadata.title || '');
      pausedAtRef.current = 0;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [lrcContent]);

  // Adjust font size to fit the box
  useEffect(() => {
    if (bratBoxRef.current && displayRef.current) {
      const boxWidth = bratBoxRef.current.offsetWidth;
      const fontSize = Math.min(boxWidth / 10, 60);
      displayRef.current.style.fontSize = `${fontSize}px`;
    }
  }, [displayText, selectedPreset]);

  // Animation loop — no state deps, reads everything from refs
  const lastDisplayTextRef = useRef('');
  const lastTimeUpdateRef = useRef(0);

  const tick = useCallback(() => {
    const lrc = parsedLrcRef.current;
    if (!lrc || lrc.lines.length === 0) return;

    const elapsed = performance.now() - startTimeRef.current;
    const duration = getLrcDuration(lrc.lines);

    if (elapsed >= duration) {
      setIsPlaying(false);
      setCurrentTime(duration);
      pausedAtRef.current = duration;
      return;
    }

    // Throttle time state updates to ~15fps (every ~66ms) for the seek bar
    if (elapsed - lastTimeUpdateRef.current > 66) {
      setCurrentTime(elapsed);
      lastTimeUpdateRef.current = elapsed;
    }
    pausedAtRef.current = elapsed;

    const newIndex = getActiveLine(lrc.lines, elapsed);

    if (newIndex !== activeLineRef.current) {
      activeLineRef.current = newIndex;
      setActiveLineIndex(newIndex);
    }

    // Word-by-word reveal: distribute words evenly across the line duration
    if (newIndex >= 0 && lrc.lines[newIndex]?.text) {
      const lineStart = lrc.lines[newIndex].time;
      const nextLine = lrc.lines[newIndex + 1];
      const lineEnd = nextLine ? nextLine.time : lineStart + 4000;
      const lineDuration = lineEnd - lineStart;
      const words = lrc.lines[newIndex].text.split(/\s+/).filter(Boolean);
      const totalWords = words.length;

      if (totalWords > 0) {
        const elapsedInLine = elapsed - lineStart;
        const wordInterval = lineDuration / totalWords;
        const wordsToShow = Math.min(
          totalWords,
          Math.floor(elapsedInLine / wordInterval) + 1
        );
        const newText = words.slice(0, wordsToShow).join(' ');
        // Only update state if text actually changed
        if (newText !== lastDisplayTextRef.current) {
          lastDisplayTextRef.current = newText;
          setDisplayText(newText);
        }
      }
    } else if (lastDisplayTextRef.current !== '') {
      lastDisplayTextRef.current = '';
      setDisplayText('');
    }

    animationRef.current = requestAnimationFrame(tick);
  }, []);

  // Start/stop animation
  useEffect(() => {
    if (isPlaying && parsedLrc) {
      startTimeRef.current = performance.now() - pausedAtRef.current;
      animationRef.current = requestAnimationFrame(tick);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, parsedLrc, tick]);

  const handlePlay = () => {
    if (!parsedLrc || parsedLrc.lines.length === 0) return;
    setIsPlaying(true);
  };

  const handlePause = () => {
    pausedAtRef.current = currentTime;
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveLineIndex(-1);
    activeLineRef.current = -1;
    pausedAtRef.current = 0;
    if (parsedLrc?.metadata.title) {
      setDisplayText(parsedLrc.metadata.title);
    } else {
      setDisplayText('');
    }
  };

  const handleSkipBack = () => {
    if (!parsedLrc || parsedLrc.lines.length === 0) return;
    const prevIndex = Math.max(0, activeLineRef.current - 1);
    const prevTime = parsedLrc.lines[prevIndex]?.time ?? 0;
    pausedAtRef.current = prevTime;
    activeLineRef.current = prevIndex;
    setCurrentTime(prevTime);
    setActiveLineIndex(prevIndex);
    if (parsedLrc.lines[prevIndex]?.text) {
      setDisplayText(parsedLrc.lines[prevIndex].text);
    }
    if (isPlaying) {
      startTimeRef.current = performance.now() - prevTime;
    }
  };

  const handleSkipForward = () => {
    if (!parsedLrc || parsedLrc.lines.length === 0) return;
    const nextIndex = Math.min(parsedLrc.lines.length - 1, activeLineRef.current + 1);
    const nextTime = parsedLrc.lines[nextIndex]?.time ?? 0;
    pausedAtRef.current = nextTime;
    activeLineRef.current = nextIndex;
    setCurrentTime(nextTime);
    setActiveLineIndex(nextIndex);
    if (parsedLrc.lines[nextIndex]?.text) {
      setDisplayText(parsedLrc.lines[nextIndex].text);
    }
    if (isPlaying) {
      startTimeRef.current = performance.now() - nextTime;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!parsedLrc) return;
    const seekTime = parseInt(e.target.value, 10);
    pausedAtRef.current = seekTime;
    setCurrentTime(seekTime);
    const newIndex = getActiveLine(parsedLrc.lines, seekTime);
    activeLineRef.current = newIndex;
    setActiveLineIndex(newIndex);
    if (newIndex >= 0 && parsedLrc.lines[newIndex]?.text) {
      setDisplayText(parsedLrc.lines[newIndex].text);
    }
    if (isPlaying) {
      startTimeRef.current = performance.now() - seekTime;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLrcContent(content);
        setShowInput(false);
      }
    };
    reader.readAsText(file);
  };

  const handlePresetChange = (value: string) => {
    const newPreset = colorPresets.find((preset) => preset.value === value);
    if (newPreset) {
      setSelectedPreset(newPreset);
    }
  };

  const handleDownload = () => {
    if (bratBoxRef.current) {
      toPng(bratBoxRef.current, { quality: 0.95 })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `brat-lrc-${displayText.slice(0, 20).replace(/\s+/g, '-') || 'cover'}.png`;
          link.click();
        })
        .catch((error) => {
          console.error('Failed to capture image: ', error);
        });
    }
  };

  const handleLoadSample = () => {
    setLrcContent(sampleLrc);
    setShowInput(false);
  };

  const duration = parsedLrc ? getLrcDuration(parsedLrc.lines) : 0;

  return (
    <div className='flex flex-col items-center'>
      {/* Brat Cover Display */}
      <div
        ref={bratBoxRef}
        className='relative mb-4 flex aspect-square w-full max-w-md items-center justify-center overflow-hidden shadow-lg'
        style={{ backgroundColor: selectedPreset.backgroundColor }}
      >
        <div
          ref={displayRef}
          className='absolute inset-0 z-10 flex h-full w-full items-center justify-center overflow-hidden text-center text-4xl'
          style={{
            color: selectedPreset.textColor,
            fontWeight: 'bold',
            fontFamily: 'arialnarrow, Arial Narrow, Arial, sans-serif',
            lineHeight: 1.2,
            padding: '20px',
            filter: 'blur(1.7px)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {displayText || (parsedLrc?.metadata.title ?? 'Load an LRC file')}
        </div>
      </div>

      {/* Transport Controls */}
      <div className='mb-3 flex w-full max-w-md items-center gap-2'>
        <span className='w-12 text-right text-xs text-muted-foreground'>
          {formatTime(currentTime)}
        </span>
        <input
          type='range'
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className='lrc-seek-bar h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted'
        />
        <span className='w-12 text-xs text-muted-foreground'>
          {formatTime(duration)}
        </span>
      </div>

      <div className='mb-4 flex items-center gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={handleReset}
          title='Reset'
        >
          <RotateCcwIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={handleSkipBack}
          title='Previous line'
        >
          <SkipBackIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          onClick={isPlaying ? handlePause : handlePlay}
          className='h-10 w-10 rounded-full'
          disabled={!parsedLrc || parsedLrc.lines.length === 0}
        >
          {isPlaying ? (
            <PauseIcon className='h-5 w-5' />
          ) : (
            <PlayIcon className='h-5 w-5' />
          )}
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={handleSkipForward}
          title='Next line'
        >
          <SkipForwardIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={handleDownload}
          title='Download current frame'
        >
          <DownloadIcon className='h-4 w-4' />
        </Button>
      </div>

      {/* Lyrics timeline */}
      {parsedLrc && parsedLrc.lines.length > 0 && (
        <div className='mb-4 h-40 w-full max-w-md overflow-y-auto rounded-md border bg-muted/30 p-3'>
          <div className='space-y-1'>
            {parsedLrc.lines.map((line, index) => (
              <button
                key={`${line.time}-${index}`}
                onClick={() => {
                  pausedAtRef.current = line.time;
                  activeLineRef.current = index;
                  setCurrentTime(line.time);
                  setActiveLineIndex(index);
                  if (line.text) setDisplayText(line.text);
                  if (isPlaying) {
                    startTimeRef.current = performance.now() - line.time;
                  }
                }}
                className={`block w-full rounded px-2 py-1 text-left text-sm transition-all ${
                  index === activeLineIndex
                    ? 'bg-primary text-primary-foreground font-medium scale-[1.02]'
                    : index < activeLineIndex
                      ? 'text-muted-foreground'
                      : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className='mr-2 inline-block w-10 font-mono text-xs opacity-60'>
                  {formatTime(line.time)}
                </span>
                {line.text || '♪'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metadata display */}
      {parsedLrc?.metadata.title && (
        <div className='mb-3 text-center text-sm text-muted-foreground'>
          {parsedLrc.metadata.artist && (
            <span className='font-medium'>{parsedLrc.metadata.artist}</span>
          )}
          {parsedLrc.metadata.artist && parsedLrc.metadata.title && ' — '}
          {parsedLrc.metadata.title}
        </div>
      )}

      {/* Controls row */}
      <div className='mb-4 flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row'>
        <Select onValueChange={handlePresetChange} value={selectedPreset.value}>
          <SelectTrigger className='w-full sm:w-[180px]'>
            <SelectValue placeholder='Select a preset' />
          </SelectTrigger>
          <SelectContent>
            {colorPresets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant='outline'
          onClick={() => setShowInput(!showInput)}
          className='w-full sm:w-[180px]'
        >
          <FileTextIcon className='mr-2 h-4 w-4' />
          {showInput ? 'Hide Editor' : 'Edit LRC'}
        </Button>

        <div className='flex w-full gap-2 sm:w-auto'>
          <Button
            variant='secondary'
            onClick={() => fileInputRef.current?.click()}
            className='flex-1 sm:w-auto'
          >
            <UploadIcon className='mr-2 h-4 w-4' /> Upload .lrc
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.lrc,.txt'
            onChange={handleFileUpload}
            className='hidden'
          />
        </div>
      </div>

      {/* LRC Text Editor */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='w-full max-w-md overflow-hidden'
          >
            <div className='space-y-2 pb-4'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='lrc-input' className='text-sm font-medium'>
                  LRC Content
                </Label>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleLoadSample}
                  className='text-xs'
                >
                  Load Sample
                </Button>
              </div>
              <Textarea
                id='lrc-input'
                value={lrcContent}
                onChange={(e) => setLrcContent(e.target.value)}
                placeholder='Paste your LRC file content here...'
                className='font-mono text-xs'
                rows={10}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BratLrcPlayer;
