// snow.tsx
import React, { useEffect, useRef, useState } from "react";

const SnowAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Snowflake class for managing individual particles
  class Snowflake {
    x: number;
    y: number;
    radius: number;
    speed: number;
    wind: number;
    wobble: number;
    wobbleSpeed: number;
    settled: boolean;
    settledY: number;

    constructor(
      x: number,
      y: number,
      radius: number,
      speed: number,
      wind: number
    ) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.speed = speed;
      this.wind = wind;
      this.wobble = 0;
      this.wobbleSpeed = Math.random() * 0.1;
      this.settled = false;
      this.settledY = 0;
    }

    update(height: number, settledSnow: number[]) {
      if (this.settled) return;

      // Update position
      this.y += this.speed;
      this.wobble += this.wobbleSpeed;
      this.x += Math.sin(this.wobble) * 0.5 + this.wind;

      // Check for settling (snow accumulates at bottom)
      const groundLevel = height - settledSnow[Math.floor(this.x)];
      if (this.y + this.radius >= groundLevel) {
        this.y = groundLevel - this.radius;
        this.settled = true;
        this.settledY = groundLevel;
      }

      // Wrap horizontally
      if (this.x < 0) this.x = dimensions.width;
      if (this.x > dimensions.width) this.x = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();
    }
  }

  // Resize logic
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const { clientWidth, clientHeight } = canvasRef.current.parentElement!;
        setDimensions({
          width: clientWidth,
          height: clientHeight,
        });
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Snow animation
  useEffect(() => {
    if (!canvasRef.current || !dimensions.width || !dimensions.height) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const snowflakes: Snowflake[] = [];
    const maxSnowflakes = 300;
    const settledSnow = new Array(dimensions.width).fill(0);
    let lastTime = 0;

    // Initialize snowflakes
    for (let i = 0; i < maxSnowflakes; i++) {
      snowflakes.push(
        new Snowflake(
          Math.random() * dimensions.width,
          Math.random() * dimensions.height,
          Math.random() * 2 + 1,
          Math.random() * 1 + 0.5,
          Math.random() * 0.5 - 0.25
        )
      );
    }

    const animate = (currentTime: number) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Update + draw snowflakes
      snowflakes.forEach((snowflake) => {
        snowflake.update(dimensions.height, settledSnow);
        snowflake.draw(ctx);

        // Update settled snow heights
        if (snowflake.settled) {
          const x = Math.floor(snowflake.x);
          if (x >= 0 && x < dimensions.width) {
            settledSnow[x] += 0.1;
          }
        }
      });

      // Draw accumulated snow as a "mound"
      ctx.beginPath();
      ctx.moveTo(0, dimensions.height);
      for (let i = 0; i < dimensions.width; i++) {
        ctx.lineTo(i, dimensions.height - settledSnow[i]);
      }
      ctx.lineTo(dimensions.width, dimensions.height);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();

      // Respawn "settled" snowflakes at top
      snowflakes.forEach((snowflake, index) => {
        if (snowflake.settled) {
          snowflakes[index] = new Snowflake(
            Math.random() * dimensions.width,
            -10,
            Math.random() * 2 + 1,
            Math.random() * 1 + 0.5,
            Math.random() * 0.5 - 0.25
          );
        }
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [dimensions]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
};

export default SnowAnimation;
