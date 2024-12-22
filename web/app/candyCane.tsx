import React from "react";

interface CandyCaneBarProps {
  percentage: number; // 0 to 100
}

export default function CandyCaneBar({ percentage }: CandyCaneBarProps) {
  // Ensure percentage is between 0 and 100
  const validPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="loading-bar">
      <span style={{ width: `${validPercentage}%` }}>
        <style>{`
          .loading-bar {
            position: relative;
            margin: 0 auto;
            height: 20px;
            width: 100%;
            border-radius: 50px;
            background: #ddd;
          }

          .loading-bar > span {
            display: block;
            position: relative;
            height: 100%;
            border-radius: 50px;
            background-image: linear-gradient(to bottom, #fac4c0, #f60000 60%);
            box-shadow: 
              inset 0 2px 9px rgba(255,255,255,0.3),
              inset 0 -2px 6px rgba(0,0,0,0.4);
            overflow: hidden;
            transition: width 0.5s ease-in-out;
          }

          .loading-bar > span:after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background-image: linear-gradient(
              -45deg,
              rgba(255, 255, 255, .2) 25%,
              transparent 25%,
              transparent 50%,
              rgba(255, 255, 255, .2) 50%,
              rgba(255, 255, 255, .2) 75%,
              transparent 75%,
              transparent
            );
            z-index: 1;
            background-size: 50px 50px;
            border-radius: 50px;
            overflow: hidden;
            animation: load 1s infinite linear;
          }

          @keyframes load {
            0% {
              background-position: 0 0;
            }
            100% {
              background-position: 50px 50px;
            }
          }
        `}</style>
      </span>
    </div>
  );
}
