import { ImageResponse } from 'next/og';

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
          position: 'relative',
        }}
      >
        {/* Outer ring */}
        <div style={{
          position: 'absolute',
          width: 22, height: 22,
          borderRadius: '50%',
          border: '1.3px solid rgba(255,255,255,0.38)',
          top: 5, left: 5,
        }} />
        {/* Middle ring */}
        <div style={{
          position: 'absolute',
          width: 14, height: 14,
          borderRadius: '50%',
          border: '1.1px solid rgba(255,255,255,0.28)',
          top: 9, left: 9,
        }} />
        {/* Inner ring */}
        <div style={{
          position: 'absolute',
          width: 7, height: 7,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.2)',
          top: 12.5, left: 12.5,
        }} />
        {/* Sweep line at 45° toward upper-right */}
        <div style={{
          position: 'absolute',
          width: 11, height: 1.5,
          background: 'white',
          top: 15.25, left: 16,
          transformOrigin: '0 50%',
          transform: 'rotate(-45deg)',
          borderRadius: 1,
        }} />
        {/* Blip dot */}
        <div style={{
          position: 'absolute',
          width: 2.8, height: 2.8,
          borderRadius: '50%',
          background: 'white',
          top: 7.5, left: 21,
        }} />
        {/* Center dot */}
        <div style={{
          position: 'absolute',
          width: 3, height: 3,
          borderRadius: '50%',
          background: 'white',
          top: 14.5, left: 14.5,
        }} />
      </div>
    ),
    { width: 32, height: 32 },
  );
}
