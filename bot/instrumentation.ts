import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";

export function register() {
  registerOTel({
    serviceName: "santa-bot",
    traceExporter: new LangfuseExporter({
      debug: process.env.NODE_ENV === "development",
    }),
  });
}
