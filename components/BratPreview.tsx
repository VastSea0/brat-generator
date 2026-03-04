import React from 'react';
import { ColorPreset } from '@/lib/types';

interface BratPreviewProps {
  text: string;
  preset: string;
  colorPresets: ColorPreset[];
}

export const BratPreview: React.FC<BratPreviewProps> = ({
  text,
  preset,
  colorPresets,
}) => {
  const presetConfig =
    colorPresets.find((p) => p.value === preset) || colorPresets[1];
  return (
    <div
      className='flex aspect-[3/4] w-full items-center justify-center overflow-hidden shadow-sm'
      style={{ backgroundColor: presetConfig.backgroundColor }}
    >
      <div
        style={{
          color: presetConfig.textColor,
          fontWeight: 'bold',
          fontFamily: 'arialnarrow, Arial Narrow, Arial, sans-serif',
          fontSize: '24px',
          lineHeight: '1.2',
          textAlign: 'center',
          filter: 'blur(1px) contrast(1.25)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const renderBratPreview = (
  text: string,
  preset: string,
  colorPresets: ColorPreset[]
) => {
  return (
    <BratPreview text={text} preset={preset} colorPresets={colorPresets} />
  );
};
