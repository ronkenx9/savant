import { defineChain } from "viem";

export const ZG_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ZG_CHAIN_ID ?? 16602);
export const ZG_RPC =
  process.env.NEXT_PUBLIC_ZG_RPC ?? "https://evmrpc-testnet.0g.ai";
export const ZG_EXPLORER =
  process.env.NEXT_PUBLIC_ZG_EXPLORER ?? "https://chainscan-galileo.0g.ai";
export const ZG_STORAGE_EXPLORER =
  process.env.NEXT_PUBLIC_ZG_STORAGE_EXPLORER ??
  "https://storagescan-galileo.0g.ai";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "") as `0x${string}`;

export const zgGalileo = defineChain({
  id: ZG_CHAIN_ID,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: [ZG_RPC] } },
  blockExplorers: { default: { name: "0G Chainscan", url: ZG_EXPLORER } },
  testnet: true,
});

// Minimal ABI matching contracts/src/AgentINFT.sol
export const AGENT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "evolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "stateRoot", type: "string" },
      { name: "intelligence", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "list",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "unlist",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "stateRoot", type: "string" },
          { name: "version", type: "uint256" },
          { name: "intelligence", type: "uint256" },
          { name: "trainedAt", type: "uint256" },
          { name: "origin", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "listingPrice",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ROYALTY_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AgentEvolved",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "version", type: "uint256", indexed: false },
      { name: "intelligence", type: "uint256", indexed: false },
      { name: "stateRoot", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentSold",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RoyaltyPaid",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "origin", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
