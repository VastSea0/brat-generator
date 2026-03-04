'use client';

import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';
import Link from 'next/link';
import {
  BratCreation,
  colorPresets,
  User,
  Vote,
  ColorPreset,
} from '@/lib/types'; // Import ColorPreset
import { renderBratPreview } from '@/components/BratPreview';

interface SavedCreationsProps {
  creations: BratCreation[];
  votes: Vote[];
  user: User | undefined;
  handleVote: (creationId: string, orientation: 'upvote' | 'downvote') => void;
  setBratText: (text: string) => void;
  setSelectedPreset: (preset: ColorPreset) => void; // Specify the type as ColorPreset
  setActiveTab: (tab: string) => void;
  updateQueryParams: (text: string, preset: string) => void;
}

const SavedCreations = ({
  creations,
  votes,
  user,
  handleVote,
  setBratText,
  setSelectedPreset,
  setActiveTab,
  updateQueryParams,
}: SavedCreationsProps) => (
  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
    {creations.map((creation) => {
      const creationVotes = votes.filter(
        (v) => v.bratCreationId === creation.id
      );
      const upvotes = creationVotes.filter(
        (v) => v.orientation === 'upvote'
      ).length;
      const downvotes = creationVotes.filter(
        (v) => v.orientation === 'downvote'
      ).length;
      const userVote = user
        ? creationVotes.find((v) => v.createdUserId === user.id)
        : null;

      return (
        <motion.div
          key={creation.id}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8 }}
        >
          <Card key={creation.id} className='flex flex-col'>
            <CardHeader className='p-4'>
              <Link
                href={`/?text=${encodeURIComponent(creation.text)}&preset=${creation.preset}`}
                onClick={(e) => {
                  e.preventDefault();
                  setBratText(creation.text);
                  const selectedPreset = colorPresets.find(
                    (preset) => preset.value === creation.preset
                  );
                  if (selectedPreset) {
                    setSelectedPreset(selectedPreset); // Use the correct preset type
                  }
                  setActiveTab('create');
                  updateQueryParams(creation.text, creation.preset);
                }}
                passHref
              >
                <CardTitle className='cursor-pointer truncate text-lg hover:underline'>
                  {creation.text}
                </CardTitle>
              </Link>
            </CardHeader>
            <CardContent className='flex-grow p-4 pt-0'>
              {renderBratPreview(creation.text, creation.preset, colorPresets)}
              <p className='mt-2 text-sm text-muted-foreground'>
                Preset: {creation.preset}
              </p>
              <p className='text-sm text-muted-foreground'>
                Created: {new Date(creation.createdAt).toLocaleString()}
              </p>
            </CardContent>
            <CardFooter className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <Button
                  size='sm'
                  variant={
                    userVote?.orientation === 'upvote' ? 'default' : 'outline'
                  }
                  onClick={() => handleVote(creation.id, 'upvote')}
                >
                  <ThumbsUpIcon className='mr-1 h-4 w-4' />
                  {upvotes}
                </Button>
                <Button
                  size='sm'
                  variant={
                    userVote?.orientation === 'downvote' ? 'default' : 'outline'
                  }
                  onClick={() => handleVote(creation.id, 'downvote')}
                >
                  <ThumbsDownIcon className='mr-1 h-4 w-4' />
                  {downvotes}
                </Button>
              </div>
              <div className='text-sm font-medium'>
                Score: {upvotes - downvotes}
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      );
    })}
  </div>
);

SavedCreations.displayName = 'SavedCreations';

export default SavedCreations;
