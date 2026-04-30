import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#7c3aed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Center dot with concentric ring box-shadows = radar rings */}
        <div
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'white',
            boxShadow:
              '0 0 0 3.5px rgba(255,255,255,0.28), 0 0 0 7px rgba(255,255,255,0.2), 0 0 0 10.5px rgba(255,255,255,0.14)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { width: 32, height: 32 },
  );
}
