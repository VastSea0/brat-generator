'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DownloadIcon, CloudIcon, CheckCircleIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { ColorPreset, colorPresets } from '@/lib/types';
import { db } from '@/lib/db';
import { tx } from '@instantdb/react';
import { id } from '@instantdb/core';
import dynamic from 'next/dynamic';
import { toPng } from 'html-to-image';

const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false });

interface BratCreationFormProps {
  bratText: string;
  setBratText: (text: string) => void;
  selectedPreset: ColorPreset;
  setSelectedPreset: (preset: ColorPreset) => void;
  updateQueryParams: (text: string, preset: string) => void;
}

function BratCreationForm({
  bratText,
  setBratText,
  selectedPreset,
  setSelectedPreset,
  updateQueryParams,
}: BratCreationFormProps) {
  const bratBoxRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiComplete, setConfettiComplete] = useState(false);

  useEffect(() => {
    adjustDisplaySize();
  }, [bratText, selectedPreset]);

  const adjustDisplaySize = () => {
    if (bratBoxRef.current && displayRef.current) {
      const boxWidth = bratBoxRef.current.offsetWidth;
      const fontSize = Math.min(boxWidth / 10, 60);
      displayRef.current.style.fontSize = `${fontSize}px`;
    }
  };

  const handlePresetChange = (value: string) => {
    const newPreset = colorPresets.find((preset) => preset.value === value);
    if (newPreset) {
      setSelectedPreset(newPreset);
      updateQueryParams(bratText, newPreset.value);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setBratText(newText);
    updateQueryParams(newText, selectedPreset.value);
  };

  const handleDownload = () => {
    if (bratBoxRef.current) {
      toPng(bratBoxRef.current, { quality: 0.95 })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'brat-creation.png';
          link.click();
        })
        .catch((error) => {
          console.error('Failed to capture image: ', error);
        });
    }
  };

  const handleSave = () => {
    const bratCreation = {
      text: bratText,
      preset: selectedPreset.value,
      createdAt: Date.now(),
    };
    db.transact(
      tx.bratCreations[id()].update({
        ...bratCreation,
      })
    );

    setShowSaveAnimation(true);
    setShowConfetti(true);
    setConfettiComplete(false);

    setTimeout(() => {
      setShowSaveAnimation(false);
    }, 2000);
  };

  const handleConfettiComplete = () => {
    setConfettiComplete(true);
    setShowConfetti(false);
  };

  return (
    <div className='flex flex-col items-center'>
      {showConfetti && !confettiComplete && (
        <ReactConfetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          onConfettiComplete={handleConfettiComplete}
        />
      )}
      <div
        ref={bratBoxRef}
        className='relative mb-4 flex aspect-[3/4] w-full max-w-md items-center justify-center overflow-hidden shadow-lg'
        style={{ backgroundColor: selectedPreset.backgroundColor }}
      >
        <div
          ref={displayRef}
          className='absolute inset-0 z-10 flex h-full w-full resize-none items-center justify-center overflow-hidden text-center text-4xl outline-none'
          style={{
            color: selectedPreset.textColor,
            fontWeight: 'bold',
            fontFamily: 'arialnarrow, Arial Narrow, Arial, sans-serif',
            lineHeight: 1.2,
            padding: '10px',
            filter: 'blur(1.7px)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {bratText}
        </div>
      </div>
      <Textarea
        value={bratText}
        onChange={handleTextChange}
        placeholder='Enter your text here'
        className='mb-4 w-full max-w-md'
        rows={4}
      />
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
        <div className='relative w-full sm:w-[180px]'>
          <Button onClick={handleSave} className='w-full'>
            <CloudIcon className='mr-2 h-4 w-4' /> Upload
          </Button>
          <AnimatePresence>
            {showSaveAnimation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className='absolute inset-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground'
              >
                <CheckCircleIcon className='mr-2 h-4 w-4' /> Saved!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button
          onClick={handleDownload}
          variant='secondary'
          className='w-full sm:w-[180px]'
        >
          <DownloadIcon className='mr-2 h-4 w-4' /> Download
        </Button>
      </div>
    </div>
  );
}

export default BratCreationForm;
