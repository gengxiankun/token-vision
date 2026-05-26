'use client';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: '#00ff41',
      fontFamily: 'monospace',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '4rem' }}>404</div>
      <div>Page not found</div>
      <a
        href="/token-vision/"
        style={{
          color: '#00ff41',
          textDecoration: 'underline',
          fontSize: '0.9rem',
        }}
      >
        ← Back to dashboard
      </a>
    </div>
  );
}
