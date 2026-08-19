/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly NEXT_PUBLIC_SUPABASE_URL: string;
    readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
    readonly VITE_BATCH_TOKEN_CONTRACT_ADDRESS: string;
    readonly VITE_HANDOVER_CONTRACT_ADDRESS: string;
    readonly VITE_BLOCKCHAIN_CHAIN_ID: string;
    readonly VITE_BLOCKCHAIN_CHAIN_NAME: string;
    readonly VITE_BLOCKCHAIN_RPC_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
