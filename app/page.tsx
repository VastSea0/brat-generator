'use client';

import { useState, useEffect, Suspense } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useSearchParams } from 'next/navigation';
import { ColorPreset, colorPresets } from '@/lib/types';
import BratCreationForm from '@/components/BratCreationForm';
import BratLrcPlayer from '@/components/BratLrcPlayer';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          Loading...
        </div>
      }
    >
      <BratGenerator />
    </Suspense>
  );
}

function BratGenerator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const charliSongLines = [
    'Boom Clap, the sound of my heart!💖💥',
    "I don't wanna go to school, I just wanna break the rules!🕺🎉",
    "Boys, I was busy dreaming 'bout boys! 🧠💭💃",
    'Vroom Vroom, bitches!💨🚀',
    "I'm so fancy, you already know!✨🔥",
    'Unlock it, lock it, unlock it!🔐🎤',
    'I just wanna go back, back to 1999!⏳💔',
    'Blame it on your love, love every time!💘🚨',
    'Take my hand, let me be your fantasy!✋✨🌟',
    "Doing it, doing it, we're doing it well!💪🌈",
  ];

  const getRandomSongLine = () =>
    charliSongLines[Math.floor(Math.random() * charliSongLines.length)];

  const { trigger } = useWebHaptics();
  const [bratText, setBratText] = useState(getRandomSongLine());
  const [selectedPreset, setSelectedPreset] = useState<ColorPreset>(
    colorPresets[1]
  );
  const [activeTab, setActiveTab] = useState('create');

  useEffect(() => {
    const textFromQuery = searchParams.get('text');
    if (textFromQuery) {
      setBratText(decodeURIComponent(textFromQuery));
      setActiveTab('create');
    }

    const presetFromQuery = searchParams.get('preset');
    if (presetFromQuery) {
      const newPreset = colorPresets.find(
        (preset) => preset.value === presetFromQuery
      );
      if (newPreset) {
        setSelectedPreset(newPreset);
      }
    }
  }, [searchParams]);

  const updateQueryParams = (text: string, preset: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('text', encodeURIComponent(text));
    params.set('preset', preset);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground'>
      <Card className='w-full max-w-4xl'>
        <CardHeader>
          <CardTitle>BRAT Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => { trigger('selection'); setActiveTab(v); }}
            className='w-full'
          >
            <TabsList className='mb-4 grid w-full grid-cols-2 rounded-md bg-muted p-1'>
              <TabsTrigger
                value='create'
                className='transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
              >
                Create
              </TabsTrigger>
              <TabsTrigger
                value='lrc'
                className='transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
              >
                LRC Cover
              </TabsTrigger>
            </TabsList>
            <div className='min-h-[800px] overflow-hidden'>
              <TabsContent value='create' className='h-full'>
                <BratCreationForm
                  bratText={bratText}
                  setBratText={setBratText}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  updateQueryParams={updateQueryParams}
                />
              </TabsContent>
              <TabsContent value='lrc' className='h-full'>
                <BratLrcPlayer
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
