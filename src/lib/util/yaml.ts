import * as yaml from "yaml";
import * as fs from "fs";
import { CoreMessage } from "ai";
import path from "path";

interface IncludedData {
  [key: string]: any;
}

export class YamlReader {
  private data: any;
  private basePath: string;
  private parsed: any;

  constructor(filePath: string) {
    this.basePath = path.dirname(filePath);
    this.parsed = this.loadYaml(filePath);
    this.data = this.resolveIncludes(this.parsed);
  }

  private loadYaml(filePath: string): any {
    const fileContents = fs.readFileSync(filePath, "utf8");
    return yaml.parse(fileContents);
  }

  private resolveIncludes(obj: any): any {
    if (!obj) return obj;

    if (obj.includes) {
      const includedData: IncludedData = {};

      Object.entries(obj.includes).forEach(
        ([key, includePath]: [string, any]) => {
          if (!includePath || typeof includePath !== "string") {
            throw new Error(
              `Include path for key "${key}" must be a string, received: ${typeof includePath}. Value: ${JSON.stringify(
                includePath
              )}`
            );
          }
          for (const [k, v] of Object.entries(this.loadYaml(includePath))) {
            includedData[`${key}.${k}`] = v;
          }
        }
      );

      return { ...includedData, ...obj };
    }

    return {};
  }

  get(path: string, variables: Record<string, string> = {}): any {
    const mergedVariables = { ...this.data, ...variables };
    const value = this.getNestedValue(this.parsed, path.split("."));
    return this.replaceVariablesRecursively(value, mergedVariables);
  }

  getPrompt(
    name: string,
    variables: Record<string, string> = {}
  ): CoreMessage[] {
    const mergedVariables = { ...this.data, ...variables };

    const rawMessages = this.get(name) as Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;

    return rawMessages.map((message) => ({
      role: message.role,
      content: this.replaceVariablesRecursively(
        message.content,
        mergedVariables
      ),
    }));
  }

  getMultiple(paths: string[], variables: Record<string, string> = {}): any[] {
    return paths.map((path) => this.get(path, variables));
  }

  private replaceVariablesRecursively(
    value: any,
    variables: Record<string, string>
  ): any {
    if (typeof value === "string") {
      return Object.entries(variables).reduce((result, [key, replacement]) => {
        const pattern = new RegExp(`{{${key}}}`, "g");
        return result.replace(pattern, replacement);
      }, value);
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.replaceVariablesRecursively(item, variables)
      );
    }

    if (value && typeof value === "object") {
      return Object.entries(value).reduce(
        (result, [key, val]) => ({
          ...result,
          [key]: this.replaceVariablesRecursively(val, variables),
        }),
        {}
      );
    }

    return value;
  }

  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => {
      return current && current[key];
    }, obj);
  }
}
