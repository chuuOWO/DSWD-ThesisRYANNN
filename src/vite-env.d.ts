/// <reference types="vite/client" />

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}


declare global {
  interface ImportMetaEnv {
    readonly NEXT_PUBLIC_SUPABASE_URL: string;
    readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_BATCH_TOKEN_CONTRACT_ADDRESS: string;
    readonly VITE_HANDOVER_CONTRACT_ADDRESS: string;
    readonly VITE_BLOCKCHAIN_CHAIN_ID: string;
    readonly VITE_BLOCKCHAIN_CHAIN_NAME: string;
    readonly VITE_BLOCKCHAIN_RPC_URL: string;
    readonly VITE_WALLETCONNECT_PROJECT_ID: string;
    readonly VITE_ADMIN_WALLET_ADDRESS: string;
    readonly VITE_TRUCKER_WALLET_ADDRESS: string;
    readonly VITE_LGU_WALLET_ADDRESS: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
