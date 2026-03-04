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
  VideoIcon,
  ImageIcon,
  LoaderIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ColorPreset, colorPresets } from '@/lib/types';
import {
  parseLrc,
  getActiveLine,
  getLrcDuration,
  getTextAtTime,
  formatTime,
  sampleLrc,
  type ParsedLrc,
} from '@/lib/lrc-parser';
import { toPng } from 'html-to-image';

const VIDEO_CANVAS_SIZE = 800;
const VIDEO_FPS = 30;
const GIF_CANVAS_SIZE = 400;
const GIF_FPS = 10;

function paintBratFrame(
  canvas: HTMLCanvasElement,
  text: string,
  bgColor: string,
  textColor: string,
  size: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  if (!text) return;
  ctx.save();
  ctx.filter = 'blur(1.7px)';
  ctx.fillStyle = textColor;
  const fontSize = Math.floor(size / 10);
  ctx.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = size - 40;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  const lineHeight = fontSize * 1.2;
  const startY = size / 2 - ((lines.length - 1) * lineHeight) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], size / 2, startY + i * lineHeight);
  }
  ctx.restore();
}

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

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportType, setExportType] = useState<'video' | 'gif' | null>(null);
  const [exportStart, setExportStart] = useState(0);
  const [exportEnd, setExportEnd] = useState(0);

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
      const dur = getLrcDuration(parsed.lines);
      setExportStart(0);
      setExportEnd(dur);
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

  // --- Playback animation loop ---
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

    const currentText = getTextAtTime(lrc.lines, elapsed);
    if (currentText !== lastDisplayTextRef.current) {
      lastDisplayTextRef.current = currentText;
      setDisplayText(currentText);
    }

    animationRef.current = requestAnimationFrame(tick);
  }, []);

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

  // --- Playback controls ---
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
    lastDisplayTextRef.current = '';
    setDisplayText(parsedLrc?.metadata.title || '');
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
    const nextIndex = Math.min(
      parsedLrc.lines.length - 1,
      activeLineRef.current + 1
    );
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
    const text = getTextAtTime(parsedLrc.lines, seekTime);
    lastDisplayTextRef.current = text;
    setDisplayText(text || parsedLrc.metadata.title || '');
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
    if (newPreset) setSelectedPreset(newPreset);
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
        .catch((err) => console.error('Failed to capture image:', err));
    }
  };

  const handleLoadSample = () => {
    setLrcContent(sampleLrc);
    setShowInput(false);
  };

  // =============================================
  // OFFLINE EXPORT — renders all frames instantly
  // =============================================

  const exportVideo = useCallback(async () => {
    if (!parsedLrc || parsedLrc.lines.length === 0) return;

    setIsExporting(true);
    setExportType('video');
    setExportProgress(0);
    setIsPlaying(false);

    const size = VIDEO_CANVAS_SIZE;
    const fps = VIDEO_FPS;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const start = exportStart;
    const end = exportEnd;
    const totalDuration = end - start;
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(totalDuration / frameInterval);

    const stream = canvas.captureStream(0);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const downloadPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'brat-lrc.webm';
        link.click();
        URL.revokeObjectURL(url);
        resolve();
      };
    });

    recorder.start();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoTrack = stream.getVideoTracks()[0] as any;

    for (let i = 0; i < totalFrames; i++) {
      const t = start + i * frameInterval;
      const text = getTextAtTime(parsedLrc.lines, t);
      paintBratFrame(
        canvas,
        text,
        selectedPreset.backgroundColor,
        selectedPreset.textColor,
        size
      );

      if (videoTrack.requestFrame) {
        videoTrack.requestFrame();
      }

      // Yield to let MediaRecorder process the frame
      await new Promise((r) => setTimeout(r, 0));

      if (i % 10 === 0) {
        setExportProgress(Math.round((i / totalFrames) * 100));
      }
    }

    recorder.stop();
    await downloadPromise;

    setIsExporting(false);
    setExportType(null);
    setExportProgress(100);
  }, [parsedLrc, selectedPreset, exportStart, exportEnd]);

  const exportGif = useCallback(async () => {
    if (!parsedLrc || parsedLrc.lines.length === 0) return;

    setIsExporting(true);
    setExportType('gif');
    setExportProgress(0);
    setIsPlaying(false);

    const size = GIF_CANVAS_SIZE;
    const fps = GIF_FPS;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const start = exportStart;
    const end = exportEnd;
    const totalDuration = end - start;
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(totalDuration / frameInterval);
    const delay = Math.round(1000 / fps);

    const gifenc = await import('gifenc');
    const encoder = gifenc.GIFEncoder();

    for (let i = 0; i < totalFrames; i++) {
      const t = start + i * frameInterval;
      const text = getTextAtTime(parsedLrc.lines, t);
      paintBratFrame(
        canvas,
        text,
        selectedPreset.backgroundColor,
        selectedPreset.textColor,
        size
      );

      const imageData = ctx.getImageData(0, 0, size, size);
      const palette = gifenc.quantize(imageData.data, 256);
      const index = gifenc.applyPalette(imageData.data, palette);
      encoder.writeFrame(index, size, size, { palette, delay });

      // Yield every 5 frames so UI can update progress
      if (i % 5 === 0) {
        setExportProgress(Math.round((i / totalFrames) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    encoder.finish();
    const output = encoder.bytes();
    const blob = new Blob([new Uint8Array(output)], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'brat-lrc.gif';
    link.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    setExportType(null);
    setExportProgress(100);
  }, [parsedLrc, selectedPreset, exportStart, exportEnd]);

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
          disabled={isExporting}
          className='lrc-seek-bar h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted disabled:opacity-50'
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
          disabled={isExporting}
        >
          <RotateCcwIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={handleSkipBack}
          title='Previous line'
          disabled={isExporting}
        >
          <SkipBackIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          onClick={isPlaying ? handlePause : handlePlay}
          className='h-10 w-10 rounded-full'
          disabled={!parsedLrc || parsedLrc.lines.length === 0 || isExporting}
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
          disabled={isExporting}
        >
          <SkipForwardIcon className='h-4 w-4' />
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={handleDownload}
          title='Download current frame as PNG'
          disabled={isExporting}
        >
          <DownloadIcon className='h-4 w-4' />
        </Button>
      </div>

      {/* Export Section */}
      <div className='mb-4 w-full max-w-md rounded-md border bg-muted/20 p-4'>
        <div className='mb-3 text-sm font-medium'>Export Video / GIF</div>

        {/* Range selection */}
        <div className='mb-3 grid grid-cols-2 gap-3'>
          <div>
            <Label className='mb-1 block text-xs text-muted-foreground'>
              Start: {formatTime(exportStart)}
            </Label>
            <input
              type='range'
              min={0}
              max={duration}
              step={100}
              value={exportStart}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setExportStart(Math.min(v, exportEnd - 500));
              }}
              disabled={isExporting}
              className='lrc-seek-bar h-2 w-full cursor-pointer appearance-none rounded-full bg-muted disabled:opacity-50'
            />
          </div>
          <div>
            <Label className='mb-1 block text-xs text-muted-foreground'>
              End: {formatTime(exportEnd)}
            </Label>
            <input
              type='range'
              min={0}
              max={duration}
              step={100}
              value={exportEnd}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setExportEnd(Math.max(v, exportStart + 500));
              }}
              disabled={isExporting}
              className='lrc-seek-bar h-2 w-full cursor-pointer appearance-none rounded-full bg-muted disabled:opacity-50'
            />
          </div>
        </div>

        <div className='mb-3 text-center text-xs text-muted-foreground'>
          Duration: {formatTime(Math.max(0, exportEnd - exportStart))}
        </div>

        {isExporting ? (
          <div className='space-y-2'>
            <div className='flex items-center justify-center gap-2 text-sm'>
              <LoaderIcon className='h-4 w-4 animate-spin' />
              {exportType === 'video' ? 'Video' : 'GIF'} oluşturuluyor...
              %{exportProgress}
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-primary transition-all duration-150'
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className='flex items-center justify-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={exportVideo}
              disabled={!parsedLrc || parsedLrc.lines.length === 0}
            >
              <VideoIcon className='mr-1 h-4 w-4' /> Video (.webm)
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={exportGif}
              disabled={!parsedLrc || parsedLrc.lines.length === 0}
            >
              <ImageIcon className='mr-1 h-4 w-4' /> GIF
            </Button>
          </div>
        )}
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
                  const text = getTextAtTime(parsedLrc.lines, line.time);
                  lastDisplayTextRef.current = text;
                  setDisplayText(text || line.text);
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
