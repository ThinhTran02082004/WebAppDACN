import React, { useEffect, useState } from 'react';

const ChristmasTheme = () => {
  const [snowflakes, setSnowflakes] = useState([]);

  useEffect(() => {
    // Tạo tuyết rơi
    const createSnowflakes = () => {
      const flakes = [];
      for (let i = 0; i < 50; i++) {
        flakes.push({
          id: i,
          left: Math.random() * 100,
          animationDelay: Math.random() * 5,
          animationDuration: 5 + Math.random() * 5,
          size: Math.random() * 4 + 2
        });
      }
      setSnowflakes(flakes);
    };

    createSnowflakes();
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Tuyết rơi */}
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-white opacity-75"
          style={{
            left: `${flake.left}%`,
            top: '-10px',
            animation: `fall ${flake.animationDuration}s linear infinite`,
            animationDelay: `${flake.animationDelay}s`,
            fontSize: `${flake.size}px`
          }}
        >
          ❄
        </div>
      ))}

      {/* Sao trang trí */}
      <div className="absolute top-10 left-10 text-yellow-300 text-4xl animate-pulse">
        ⭐
      </div>
      <div className="absolute top-20 right-20 text-yellow-300 text-3xl animate-pulse" style={{ animationDelay: '0.5s' }}>
        ⭐
      </div>
      <div className="absolute bottom-20 left-1/4 text-yellow-300 text-2xl animate-pulse" style={{ animationDelay: '1s' }}>
        ⭐
      </div>

      {/* Cây thông nhỏ */}
      <div className="absolute bottom-0 left-1/4 transform -translate-x-1/2 text-6xl opacity-20">
        🎄
      </div>
      <div className="absolute bottom-0 right-1/4 transform translate-x-1/2 text-6xl opacity-20">
        🎄
      </div>

      {/* CSS Animation cho tuyết rơi */}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ChristmasTheme;

