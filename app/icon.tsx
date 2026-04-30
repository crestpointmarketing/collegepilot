import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 32, height: 32, background: '#7c3aed', borderRadius: 6, display: 'flex' }} />,
    { width: 32, height: 32 },
  );
}
