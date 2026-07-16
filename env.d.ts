export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      T_INVEST_READONLY_TOKEN: string;
    }
  }
}
