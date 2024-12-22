"use client";

import React, { useEffect, useState } from "react";
import {
  Terminal,
  Heart,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MessageCircle,
  Share2,
  Clipboard,
} from "lucide-react";
import CandyCaneBar from "./candyCane";
import SnowAnimation from "./snow"; // <-- Import our SnowAnimation

// ===== DETERMINISTIC "RANDOM" SNIPPETS =====
function getSecondsOfDay(date: Date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}
function lcgOnce(seed: number) {
  const val = (seed * 48271) % 2147483647;
  return val / 2147483647;
}
function getDeterministicRandom(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const s = getSecondsOfDay(date);
  const seed = y * 1_000_000 + (m + 1) * 10_000 + d * 100 + s;
  return lcgOnce(seed);
}
function getGiftsCount(date: Date) {
  const base = 3000;
  const randomFrac = getDeterministicRandom(date);
  const offset = Math.floor(randomFrac * 1000);
  return base + offset;
}
function getCoalCount(date: Date) {
  const base = 500;
  const randomFrac = getDeterministicRandom(date);
  const offset = Math.floor(randomFrac * 300);
  return base + offset;
}

export default function IntelligenceTerminal() {
  // ===== NEEDLE =====
  const BASE_ANGLE = -20; // ~30% between Naughty (0°) and Nice (180°)
  const [niceScore, setNiceScore] = useState(BASE_ANGLE);

  // ===== COUNTDOWN =====
  const now = new Date();
  const christmas = new Date(now.getFullYear(), 11, 25, 0, 0, 0);
  if (now >= christmas) {
    christmas.setFullYear(christmas.getFullYear() + 1);
  }
  const diffMs = christmas.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const initialMinutes = Math.floor(diffSeconds / 60);
  const initialSeconds = diffSeconds % 60;

  const [timeToChristmas, setTimeToChristmas] = useState({
    minutes: initialMinutes,
    seconds: initialSeconds,
  });

  // ===== GIFTS & COAL =====
  const [gifts, setGifts] = useState(0);
  const [coal, setCoal] = useState(0);

  // ===== CONTRACT ADDRESS =====
  const contractAddress = "FuqHzJsxCjqVjPNfy2PUp52515RhkofkaCkQm71qpump"; // Example placeholder

  // Notification when copied
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  const copyCA = () => {
    navigator.clipboard.writeText(contractAddress);
    setShowCopyNotification(true);
    setTimeout(() => setShowCopyNotification(false), 2000);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 1) NEEDLE JITTER
    const jitterInterval = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 6; // ±3 degrees
      setNiceScore(BASE_ANGLE + jitter);
    }, 500);

    // 2) COUNTDOWN (updates every 1s)
    const countdownInterval = setInterval(() => {
      const now = new Date();
      const christmas = new Date(now.getFullYear(), 11, 25, 0, 0, 0);
      if (now >= christmas) {
        christmas.setFullYear(christmas.getFullYear() + 1);
      }
      const diffMs = christmas.getTime() - now.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      setTimeToChristmas({ minutes, seconds });
    }, 1000);

    // 3) GIFTS & COAL (updates every 2s)
    const giftsCoalInterval = setInterval(() => {
      const now = new Date();
      setGifts(getGiftsCount(now));
      setCoal(getCoalCount(now));
    }, 2000);

    // Initial set
    const now2 = new Date();
    setGifts(getGiftsCount(now2));
    setCoal(getCoalCount(now2));

    return () => {
      clearInterval(jitterInterval);
      clearInterval(countdownInterval);
      clearInterval(giftsCoalInterval);
    };
  }, []);

  // Candy-cane progress
  const totalSecondsLeft =
    timeToChristmas.minutes * 60 + timeToChristmas.seconds;
  const MAX_SECONDS = 30 * 24 * 3600;
  const percentComplete = Math.min(
    100,
    100 - (totalSecondsLeft / MAX_SECONDS) * 100
  );

  let countdownText = "";
  if (timeToChristmas.minutes <= 0 && timeToChristmas.seconds <= 0) {
    countdownText = "Merry Christmas!";
  } else {
    countdownText = `${timeToChristmas.minutes}m ${timeToChristmas.seconds}s until Christmas`;
  }

  return (
    // 1) Position this container "relative" so snow can absolutely position on top
    <div className="relative bg-black text-green-500 p-6 min-h-screen font-mono overflow-hidden">
      {/* 2) Snow effect */}
      <SnowAnimation />

      {/* HEADER: includes Title on left, CA on right */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          {/* Left side: Terminal icon + Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Terminal size={24} />
              <h1 className="text-2xl">NORTH POLE INTELLIGENCE TERMINAL</h1>
            </div>
            <p className="text-sm opacity-70">REAL-TIME BEHAVIORAL ANALYSIS</p>
          </div>
          {/* Right side: Contract Address + Twitter Bot */}
          <div className="text-right">
            <div className="flex flex-col items-end gap-4">
              {/* Contract Address */}
              <div>
                <div className="text-sm font-bold mb-1">$COAL</div>
                <div className="flex items-center gap-2 relative">
                  <span className="text-xs">{contractAddress}</span>
                  <button
                    onClick={copyCA}
                    className="hover:text-green-300 transition-colors"
                    aria-label="Copy Contract Address"
                  >
                    <Clipboard size={16} />
                  </button>
                  {showCopyNotification && (
                    <div className="absolute -top-8 right-0 bg-green-500 text-black px-2 py-1 rounded text-xs animate-fade-out">
                      Copied
                    </div>
                  )}
                </div>
              </div>
              {/* Twitter Bot Link */}
              <div className="flex items-center gap-2 text-lg font-bold">
                <a
                  href="https://twitter.com/robosantahoho"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-300 hover:text-green-100 transition-colors"
                >
                  @robosantahoho
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* GLOBAL KINDNESS INDEX */}
      <div className="border border-green-900 p-8 mb-6 flex flex-col items-center">
        <h2 className="text-xl mb-4">GLOBAL KINDNESS INDEX</h2>
        <div className="relative w-64 h-36 mb-4">
          {/* Semi-circle border */}
          <div className="absolute inset-0 border-t-2 border-green-500 rounded-t-full" />
          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom h-32 w-1 bg-red-500"
            style={{
              transform: `rotate(${niceScore}deg)`,
              transformOrigin: "bottom center",
              transition: "transform 0.1s linear",
            }}
          />
          <div className="absolute bottom-0 left-0 text-sm">NAUGHTY</div>
          <div className="absolute bottom-0 right-0 text-sm">NICE</div>
        </div>
      </div>

      {/* COUNTDOWN */}
      <div className="border border-green-900 p-4 mb-6 text-center">
        <h2 className="text-2xl mb-4 font-bold">CHRISTMAS COUNTDOWN</h2>
        <p className="text-xl mb-4">{countdownText}</p>
        <CandyCaneBar percentage={percentComplete} />
      </div>

      {/* METRICS AND GIFTS/COAL GRID */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* GIFTS/COAL */}
        <div className="border border-green-900 p-6">
          <div className="grid grid-cols-2 gap-8 text-center">
            <div className="flex flex-col">
              <span className="text-lg text-green-400 mb-2">Gifts Queued</span>
              <span className="text-3xl font-bold text-green-400">{gifts}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg text-red-400 mb-2">Coal Queued</span>
              <span className="text-3xl font-bold text-red-400">{coal}</span>
            </div>
          </div>
        </div>

        {/* COMMUNITY IMPACT METRICS */}
        <div className="border border-green-900 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="text-green-400" />
            <h2 className="text-lg">COMMUNITY IMPACT METRICS</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Help/Support Ratio:</span>
              <span className="text-yellow-500">0.72</span>
            </div>
            <div className="flex justify-between">
              <span>Small Account Engagement:</span>
              <span className="text-blue-500">64%</span>
            </div>
            <div className="flex justify-between">
              <span>Positive Interaction Rate:</span>
              <span className="text-green-500">0.81</span>
            </div>
          </div>
        </div>

        {/* BEHAVIORAL TRENDS */}
        <div className="border border-green-900 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="text-green-400" />
            <h2 className="text-lg">BEHAVIORAL TRENDS</h2>
          </div>
          <p className="opacity-70">Weekly trend data is currently offline.</p>
        </div>
      </div>

      {/* "Copied" fade-out animation */}
      <style jsx>{`
        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-fade-out {
          animation: fadeOut 2s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
