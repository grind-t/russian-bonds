export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      T_INVEST_READONLY_TOKEN: string;
      T_INVEST_ACCOUNT_ID: string;
    }
  }
}
