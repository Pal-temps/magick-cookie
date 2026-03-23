import type { FunctionBenchConfig, FunctionBenchResult, BenchProgress } from "./bench.types";

export interface BenchLanguageAdapter {
  language: string;

  runFunctionBench(
    config: FunctionBenchConfig,
    onProgress: (p: BenchProgress) => void,
  ): Promise<FunctionBenchResult>;

  isAvailable(): Promise<boolean>;
}
