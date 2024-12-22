import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { LangfuseExporter } from "langfuse-vercel";
import * as dotenv from "dotenv";
import { Langfuse } from "langfuse";
dotenv.config();

export const langfuseExporter = new LangfuseExporter({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

export const sdk = new NodeSDK({
  traceExporter: langfuseExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});
