import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Terminal,
  GaugeCircle,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";

const weeklyData = [
  { week: "W48", authenticity: 65, community: 45, karma: 78 },
  { week: "W49", authenticity: 68, community: 52, karma: 72 },
  { week: "W50", authenticity: 72, community: 58, karma: 85 },
  { week: "W51", authenticity: 75, community: 62, karma: 82 },
];

export default function IntelligenceTerminal() {
  // Calculate position of needle (0 = fully naughty, 180 = fully nice)
  const niceScore = 120; // This would be calculated from real metrics

  return (
    <div className="bg-black text-green-500 p-6 min-h-screen font-mono">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Terminal size={24} />
          <h1 className="text-2xl">NORTH POLE INTELLIGENCE TERMINAL</h1>
        </div>
        <p className="text-sm opacity-70">REAL-TIME BEHAVIORAL ANALYSIS</p>
      </header>

      {/* Large Naughty/Nice Gauge */}
      <div className="border border-green-900 p-8 mb-6 flex flex-col items-center">
        <h2 className="text-xl mb-4">GLOBAL KINDNESS INDEX</h2>
        <div className="relative w-64 h-32 mb-4">
          <div className="absolute inset-0 border-t-2 border-green-500 rounded-t-full"></div>
          <div
            className="absolute origin-bottom rotate-[120deg] h-32 w-1 bg-red-500"
            style={{
              transform: `rotate(${niceScore}deg)`,
              transformOrigin: "bottom center",
              transition: "transform 1s ease-out",
            }}
          />
          <div className="absolute bottom-0 left-0 text-sm">NAUGHTY</div>
          <div className="absolute bottom-0 right-0 text-sm">NICE</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real-time Metrics */}
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

        {/* Engagement Patterns */}
        <div className="border border-green-900 p-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="text-green-400" />
            <h2 className="text-lg">ENGAGEMENT PATTERNS</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Original/Quote Tweet Ratio:</span>
              <span className="text-purple-500">1.8</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Response Time:</span>
              <span className="text-blue-500">14m</span>
            </div>
            <div className="flex justify-between">
              <span>Conversation Completion:</span>
              <span className="text-green-500">87%</span>
            </div>
          </div>
        </div>

        {/* Weekly Trends */}
        <div className="border border-green-900 p-4 col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="text-green-400" />
            <h2 className="text-lg">BEHAVIORAL TRENDS</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
