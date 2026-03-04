'use client';

import { useState, useEffect, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { tx } from '@instantdb/react';
import { ColorPreset, colorPresets } from '@/lib/types';
import SavedCreations from '@/components/SavedCreations';
import { id } from '@instantdb/core';
import BratCreationForm from '@/components/BratCreationForm';
import TopBrats from '@/components/TopBrats';

export default function BratGenerator() {
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

  const [bratText, setBratText] = useState(getRandomSongLine());
  const [selectedPreset, setSelectedPreset] = useState<ColorPreset>(
    colorPresets[1]
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authState, setAuthState] = useState({
    sentEmail: '',
    email: '',
    error: null as string | null,
    code: '',
  });
  const [activeTab, setActiveTab] = useState('create');

  const { isLoading, error, data } = db.useQuery({
    bratCreations: {},
    votes: {},
  });
  const { user } = db.useAuth();

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

  const handleVote = (
    creationId: string,
    orientation: 'upvote' | 'downvote'
  ) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const existingVote = data?.votes.find(
      (vote) =>
        vote.bratCreationId === creationId && vote.createdUserId === user.id
    );

    if (existingVote) {
      if (existingVote.orientation === orientation) {
        db.transact(tx.votes[existingVote.id].delete());
      } else {
        db.transact(tx.votes[existingVote.id].update({ orientation }));
      }
    } else {
      db.transact(
        tx.votes[id()].update({
          createdUserId: user.id,
          createdAt: Date.now(),
          bratCreationId: creationId,
          orientation,
        })
      );
    }
  };

  const handleSendMagicCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.email) return;

    setAuthState({ ...authState, sentEmail: authState.email, error: null });

    try {
      await db.auth.sendMagicCode({ email: authState.email });
    } catch (error) {
      if (error instanceof Error) {
        setAuthState({ ...authState, error: error.message });
      }
    }
  };

  const handleVerifyMagicCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.code) return;

    try {
      await db.auth.signInWithMagicCode({
        email: authState.sentEmail,
        code: authState.code,
      });
      setIsAuthModalOpen(false);
      setAuthState({ sentEmail: '', email: '', error: null, code: '' });
    } catch (error) {
      if (error instanceof Error) {
        setAuthState({ ...authState, error: error.message });
      }
    }
  };

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex h-screen items-center justify-center'>
        Error: {error.message}
      </div>
    );
  }

  const { bratCreations, votes } = data;

  const sortedByDate = [...bratCreations].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  const sortedByLikes = [...bratCreations].sort((a, b) => {
    const aVotes = votes.filter((v) => v.bratCreationId === a.id);
    const bVotes = votes.filter((v) => v.bratCreationId === b.id);
    const aScore =
      aVotes.filter((v) => v.orientation === 'upvote').length -
      aVotes.filter((v) => v.orientation === 'downvote').length;
    const bScore =
      bVotes.filter((v) => v.orientation === 'upvote').length -
      bVotes.filter((v) => v.orientation === 'downvote').length;
    return bScore - aScore;
  });

  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          Loading...
        </div>
      }
    >
      <div className='flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground'>
        <Card className='w-full max-w-4xl'>
          <CardHeader>
            <CardTitle>BRAT Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className='w-full'
            >
              <TabsList className='mb-4 grid w-full grid-cols-3 rounded-md bg-muted p-1'>
                <TabsTrigger
                  value='create'
                  className='transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                >
                  Create
                </TabsTrigger>
                <TabsTrigger
                  value='saved'
                  className='transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                >
                  Creations
                </TabsTrigger>
                <TabsTrigger
                  value='top'
                  className='transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                >
                  Top BRATs
                </TabsTrigger>
              </TabsList>
              <div className='h-[800px] overflow-hidden'>
                <TabsContent value='create' className='h-full'>
                  <BratCreationForm
                    bratText={bratText}
                    setBratText={setBratText}
                    selectedPreset={selectedPreset}
                    setSelectedPreset={setSelectedPreset}
                    updateQueryParams={updateQueryParams}
                  />
                </TabsContent>
                <TabsContent value='saved' className='h-full overflow-y-auto'>
                  <SavedCreations
                    creations={sortedByDate}
                    votes={votes}
                    user={user}
                    handleVote={handleVote}
                    setBratText={setBratText}
                    setSelectedPreset={setSelectedPreset}
                    setActiveTab={setActiveTab}
                    updateQueryParams={updateQueryParams}
                  />
                </TabsContent>
                <TabsContent value='top' className='h-full overflow-y-auto'>
                  <TopBrats
                    creations={sortedByLikes}
                    votes={votes}
                    user={user}
                    handleVote={handleVote}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
          <DialogContent className='bg-white sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle className='text-2xl font-bold'>
                Authentication Required
              </DialogTitle>
              <DialogDescription className='text-foreground/70'>
                Please sign in to vote on BRAT creations.
              </DialogDescription>
            </DialogHeader>
            <div className='mt-6'>
              {!authState.sentEmail ? (
                <form onSubmit={handleSendMagicCode} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='email' className='text-sm font-medium'>
                      Email
                    </Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='Enter your email'
                      value={authState.email}
                      onChange={(e) =>
                        setAuthState({
                          ...authState,
                          email: e.target.value,
                          error: null,
                        })
                      }
                      className='w-full'
                    />
                  </div>
                  <Button type='submit' className='w-full'>
                    Send Code
                  </Button>
                  {authState.error && (
                    <p className='mt-2 text-sm text-destructive'>
                      {authState.error}
                    </p>
                  )}
                </form>
              ) : (
                <form onSubmit={handleVerifyMagicCode} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='code' className='text-sm font-medium'>
                      Magic Code
                    </Label>
                    <Input
                      id='code'
                      type='text'
                      placeholder='Enter the magic code'
                      value={authState.code}
                      onChange={(e) =>
                        setAuthState({
                          ...authState,
                          code: e.target.value,
                          error: null,
                        })
                      }
                      className='w-full'
                    />
                  </div>
                  <Button type='submit' className='w-full'>
                    Verify
                  </Button>
                  {authState.error && (
                    <p className='mt-2 text-sm text-destructive'>
                      {authState.error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  );
}
