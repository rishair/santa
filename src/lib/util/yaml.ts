import * as yaml from "yaml";
import * as fs from "fs";
import { CoreMessage } from "ai";

export class YamlReader {
  private data: any;
  private variables: Record<string, string> = {};

  constructor(filePath: string) {
    const fileContents = fs.readFileSync(filePath, "utf8");
    this.data = yaml.parse(fileContents);
  }

  setVariables(variables: Record<string, string>) {
    this.variables = variables;
  }

  get(path: string, variables: Record<string, string> = {}): any {
    const mergedVariables = { ...this.variables, ...variables };
    const value = this.getNestedValue(this.data, path.split("."));
    return this.replaceVariablesRecursively(value, mergedVariables);
  }

  getPrompt(
    name: string,
    variables: Record<string, string> = {}
  ): CoreMessage[] {
    const rawMessages = this.get(name) as Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;

    return rawMessages.map((message) => ({
      role: message.role,
      content: this.replaceVariablesRecursively(message.content, variables),
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
