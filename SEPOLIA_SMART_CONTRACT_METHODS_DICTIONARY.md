# Sepolia Smart Contract Methods Dictionary
**DSWD Relief Supply Chain & Provenance Tracker**

- **Contract Address**: [`0xCde64aBedE22F9842F5678Fe4cd84781960863eC`](https://sepolia.etherscan.io/address/0xCde64aBedE22F9842F5678Fe4cd84781960863eC)
- **Network**: Ethereum Sepolia Testnet (Chain ID: `11155111`)
- **Token Standard**: ERC-1155 Multi-Token Standard + Supply Chain Custody Registry
- **Relayer Address**: `0xC699C8389B0bF6dded79f4A17EffD22a8a6434dd`

---

## 1. Quick Reference: Etherscan 4-Byte Method Selectors

When browsing transactions on Sepolia Etherscan without a decoded ABI, the **Method** column displays 4-byte hexadecimal function selectors. Below is the reference table matching every method in your system:

| 4-Byte Hex | Function Signature | Description |
| :--- | :--- | :--- |
| **`0x92a25201`** | `signReleaseWithDriver(...)` | **Warehouse Dispatch**: Admin/Relayer releases tokens from Vault into Driver A's wallet. |
| **`0x81eee186`** | `transferDriverCustody(...)` | **Driver Relay**: Driver A hands over custody and tokens to Driver B mid-route. |
| **`0xdb2e2b96`** | `confirmReceiptForLgu(...)` | **LGU Acceptance**: Destination LGU verifies and receives tokens, closing transit. |
| **`0x42ec9e74`** | `signRelease(...)` | **Legacy Dispatch**: Standard 9-arg release without explicit designated driver address. |
| **`0x2c643ed4`** | `confirmReceipt(...)` | **Legacy Receipt**: 4-arg delivery confirmation. |
| **`0xefaa2716`** | `mintBatchToken(...)` | **Batch Minting**: Mints batch allocation as ERC-1155 tokens into Escrow Vault. |
| **`0x26b82a35`** | `recordTruckLocation(...)` | **GPS Checkpoint**: Stores immutable convoy coordinates on Sepolia. |
| **`0x4b0bddd2`** | `setAdmin(...)` | **Access Control**: Grants or revokes authorized admin status. |
| **`0xf242432a`** | `safeTransferFrom(...)` | Standard ERC-1155 single-token transfer between accounts. |
| **`0x2eb2c2d6`** | `safeBatchTransferFrom(...)` | Standard ERC-1155 batch-token transfer between accounts. |
| **`0xa22cb465`** | `setApprovalForAll(...)` | Standard ERC-1155 operator approval. |

---

## 2. Detailed Method Dictionary

### State-Changing Methods (Transactions on Sepolia)

---

### `signReleaseWithDriver`
* **Selector**: `0x92a25201`
* **Full Signature**:
  ```solidity
  function signReleaseWithDriver(
      string calldata drNumber,
      string calldata handoverContractId,
      string calldata category,
      uint256 quantity,
      string[] calldata batchTokenIds,
      uint256[] calldata batchQuantities,
      string calldata fromLocation,
      string calldata destination,
      string calldata senderGps,
      address designatedDriver
  ) external returns (uint256)
  ```
* **Who Calls It**: DSWD Admin / Automated Sepolia Relayer (`0xC699...`).
* **What It Does**:
  1. Validates that the Delivery Receipt (`drNumber`) has not already been signed into transit.
  2. Creates a new `Handover` record on-chain with state set to `Released` (`status = 1`).
  3. Records the initial hop in the `handoverHops` array with the warehouse departure GPS coordinates and timestamp.
  4. Automatically transfers the required physical ERC-1155 tokens from the contract's **Escrow Vault** to the designated driver's **Smart Account** (`designatedDriver`).
  5. Emits `ReleaseSigned` and ERC-1155 `TransferSingle` events.
* **Logistics Stage**: **Warehouse Departure** (Warehouse Hub &rarr; Driver 1).

---

### `transferDriverCustody`
* **Selector**: `0x81eee186`
* **Full Signature**:
  ```solidity
  function transferDriverCustody(
      string calldata drNumber,
      address newDriver,
      string calldata transferGps,
      string calldata note
  ) external returns (uint256)
  ```
* **Who Calls It**: Current Driver / Contract Owner / Authorized Admin / Automated Relayer.
* **What It Does**:
  1. Verifies that the handover exists and that the shipment is currently in transit (`status == Released` or `status == Transshipped`).
  2. Ensures the caller is authorized (either the contract owner, admin relayer, or the current custodian driver).
  3. Updates the `currentCustodian` pointer from Driver A to `newDriver` (Driver B).
  4. Updates the handover status to `Transshipped` (`status = 2`) and increments `hopCount`.
  5. Appends a new `CustodyHop` record to the handover's on-chain history (saving previous driver, new driver, satellite GPS coordinates, and relay note).
  6. Physically transfers all associated ERC-1155 tokens from Driver A's wallet directly to Driver B's wallet via `_safeTransferFrom`.
  7. Emits `CustodyTransshipped` and ERC-1155 `TransferSingle` events.
* **Logistics Stage**: **Mid-Route Transshipment / Convoy Custody Relay** (Driver 1 &rarr; Driver 2).

---

### `confirmReceiptForLgu`
* **Selector**: `0xdb2e2b96`
* **Full Signature**:
  ```solidity
  function confirmReceiptForLgu(
      string calldata drNumber,
      string calldata handoverContractId,
      string calldata destination,
      string calldata receiverGps,
      address targetLguRecipient
  ) external returns (uint256)
  ```
* **Who Calls It**: Destination LGU Officer / Automated Sepolia Relayer.
* **What It Does**:
  1. Verifies that the shipment is currently in transit and has not already been finalized.
  2. Changes the handover status to `Accepted` (`status = 3`) and records `acceptedAt` timestamp and delivery GPS coordinates.
  3. Appends the final terminal hop into `handoverHops` from the carrier driver to the destination LGU recipient.
  4. Transfers the ERC-1155 tokens from the current carrier driver's wallet to the destination LGU's Smart Account (`targetLguRecipient`).
  5. Emits `ReceiptConfirmed` and ERC-1155 `TransferSingle` events.
* **Logistics Stage**: **Final Delivery Acceptance** (Driver 2 &rarr; Destination LGU).

---

### `mintBatchToken`
* **Selector**: `0xefaa2716`
* **Full Signature**:
  ```solidity
  function mintBatchToken(
      string calldata manifestNumber,
      string calldata batchTokenId,
      string calldata manifestHash,
      string calldata category,
      uint256 quantity,
      string calldata destination
  ) external returns (uint256)
  ```
* **Who Calls It**: DSWD Logistics Admin / Relayer.
* **What It Does**:
  1. Registers a new authentic inventory lot on-chain with a unique `batchTokenId`.
  2. Increments `currentBatchId` and maps the lot metadata (manifest number, cryptographic content hash, category, quantity, and destination).
  3. Mints the exact quantity of ERC-1155 tokens to the smart contract address itself (holding them in the **Escrow Vault** until formally released for dispatch).
  4. Emits `BatchTokenMinted` and ERC-1155 `TransferSingle` (from `0x000...` to contract address).
* **Logistics Stage**: **Warehouse Inflow & Lot Accreditation**.

---

### `recordTruckLocation`
* **Selector**: `0x26b82a35`
* **Full Signature**:
  ```solidity
  function recordTruckLocation(
      string calldata shipmentId,
      string calldata truckId,
      string calldata latitude,
      string calldata longitude,
      uint256 timestamp
  ) external
  ```
* **Who Calls It**: Escort Telemetry Relayer.
* **What It Does**:
  - Writes an immutable satellite location breadcrumb to the blockchain for critical audit checkpoints (e.g. crossing provincial borders or checkpoints).
  - Emits `TruckLocationLogged`.

---

### `setAdmin`
* **Selector**: `0x4b0bddd2`
* **Full Signature**:
  ```solidity
  function setAdmin(address admin, bool authorized) external
  ```
* **Who Calls It**: Contract Owner (`onlyOwner`).
* **What It Does**:
  - Grants or revokes administrator privileges (`isAuthorizedAdmin[admin] = authorized`), allowing authorized backend relayers to execute transactions on behalf of offline field officers without gas friction.

---

## 3. View & Inquiry Methods (Zero Gas / Read-Only)

These methods query blockchain state without submitting transactions and consume zero gas:

| Method Name | Selector | Signature | Description |
| :--- | :--- | :--- | :--- |
| **`handoverIdByDrNumber`** | `0x079adc10` | `handoverIdByDrNumber(string)` | Returns the internal `handoverId` for a given DR Number (returns `0` if not yet dispatched). |
| **`getHandover`** | `0xf7a8a284` | `getHandover(uint256)` | Returns complete shipment details: DR number, contract ID, category, quantity, current custodian driver, receiver, timestamps, GPS, status, and hop count. |
| **`getHandoverHops`** | `0x7912df67` | `getHandoverHops(uint256)` | Returns the complete array of custody transitions: previous holder, next holder, GPS coordinates, notes, and timestamps. |
| **`getBatchByTokenId`** | `0x4629d07a` | `getBatchByTokenId(string)` | Returns metadata for an allocated batch token ID (category, quantity, destination, manifest hash). |
| **`batchIdByTokenId`** | `0x34a7130d` | `batchIdByTokenId(string)` | Returns the integer ERC-1155 token ID corresponding to an alphanumeric token string (e.g. `BATCH-DR2026007` &rarr; ID `9`). |
| **`balanceOf`** | `0x00fdd58e` | `balanceOf(address,uint256)` | Returns the exact number of ERC-1155 tokens currently held in any wallet address or the contract escrow. |
| **`currentHandoverId`** | `0xa414e90c` | `currentHandoverId()` | Returns the total count of handovers registered on-chain. |
| **`isAuthorizedAdmin`** | `0x22a12450` | `isAuthorizedAdmin(address)` | Checks if a given wallet address has administrative signing permissions. |

---

## 4. Lifecycle Flow Overview

```
1. Intake & Allocation:
   mintBatchToken (0xefaa2716)
   Tokens: [0x000... (Mint)] --> [0xCde6... (Contract Escrow Vault)]

2. Warehouse Departure:
   signReleaseWithDriver (0x92a25201)
   Tokens: [0xCde6... (Contract Escrow)] --> [0x2CD9... (Joe Bone / TRUCK-11)]
   Status: 1 (Released) | Hop Count: 1

3. Convoy Relay / Transshipment:
   transferDriverCustody (0x81eee186)
   Tokens: [0x2CD9... (Joe Bone)] --> [0x10b5... (Rover Rover / TRUCK-01)]
   Status: 2 (Transshipped) | Hop Count: 2

4. Destination Acceptance:
   confirmReceiptForLgu (0xdb2e2b96)
   Tokens: [0x10b5... (Rover Rover)] --> [LGU Smart Account]
   Status: 3 (Accepted) | Hop Count: 3 (Finalized)
```

