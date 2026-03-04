import { init } from '@instantdb/react';
import { Schema } from '@/lib/types';

export const APP_ID = 'eb984380-28b4-4142-a677-5590258bd7fd';

export const db = init<Schema>({ appId: APP_ID });
