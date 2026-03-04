export type Schema = {
  bratCreations: BratCreation;
  votes: Vote;
};

export interface ColorPreset {
  label: string;
  value: string;
  textColor: string;
  backgroundColor: string;
}

export const colorPresets: ColorPreset[] = [
  {
    label: 'brat deluxe',
    value: 'bratdeluxe',
    textColor: '#000000',
    backgroundColor: '#ffffff',
  },
  {
    label: 'brat',
    value: 'brat',
    textColor: '#000000',
    backgroundColor: '#8ace00',
  },
  {
    label: 'crash',
    value: 'crash',
    textColor: '#f70000',
    backgroundColor: '#019bd9',
  },
  {
    label: "how i'm feeling now",
    value: 'howimfeelingnow',
    textColor: '#c1c1c1',
    backgroundColor: '#ffffff',
  },
  {
    label: 'charli',
    value: 'charli',
    textColor: '#000000',
    backgroundColor: '#918a84',
  },
  {
    label: 'pop 2',
    value: 'pop2',
    textColor: '#000000',
    backgroundColor: '#c9a1dd',
  },
  {
    label: 'vroom vroom',
    value: 'vroomvroom',
    textColor: '#404040',
    backgroundColor: '#000000',
  },
  {
    label: 'number 1 angel',
    value: 'number1angel',
    textColor: '#ff1000',
    backgroundColor: '#d20001',
  },
  {
    label: 'sucker',
    value: 'sucker',
    textColor: '#ffffff',
    backgroundColor: '#f5abcc',
  },
  {
    label: 'true romance',
    value: 'trueromance',
    textColor: '#ffffff',
    backgroundColor: '#700150',
  },
  {
    label: 'custom color',
    value: 'custom',
    textColor: '#8ace00',
    backgroundColor: '#000000',
  },
];

export interface BratCreation {
  id: string;
  text: string;
  preset: string;
  createdAt: number;
  createdBy: string;
}

export interface Vote {
  id: string;
  createdUserId: string;
  createdAt: number;
  bratCreationId: string;
  orientation: 'upvote' | 'downvote';
}

export interface User {
  id: string;
  email: string;
}
