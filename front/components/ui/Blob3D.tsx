import React from 'react';

export default function Blob3D() {
  return (
    <>
      <style>{`
        @keyframes blob-morph {
          0%   { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25%  { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          50%  { border-radius: 50% 60% 30% 60% / 30% 70% 60% 40%; }
          75%  { border-radius: 70% 30% 60% 40% / 60% 40% 50% 70%; }
          100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
        @keyframes blob-gradient {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes blob-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.06); }
        }
        .acs-blob {
          width: 180px;
          height: 180px;
          background: linear-gradient(135deg, #06b6d4, #8b5cf6, #06b6d4, #a855f7, #22d3ee);
          background-size: 300% 300%;
          animation:
            blob-morph   8s ease-in-out infinite,
            blob-gradient 6s ease infinite,
            blob-pulse   4s ease-in-out infinite;
          box-shadow:
            0 0 40px rgba(139, 92, 246, 0.6),
            0 0 80px rgba(6, 182, 212, 0.3),
            0 0 120px rgba(168, 85, 247, 0.2);
        }
      `}</style>
      <div className="acs-blob" />
    </>
  );
}
